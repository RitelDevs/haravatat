import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { hash } from '../server/auth.js';
import { migrate } from '../server/db.js';
import { testDatabase } from './database.js';
import { defaultBlogTheme, readBlogTheme } from '../shared/blog-theme.js';
const headers = { origin: 'http://localhost:5173', 'x-haravatat-request': '1' };
test('blog themes persist by owner, validate strict configuration and serve consistent public defaults and article themes', async () => {
  const { db, close } = await testDatabase();
  await db.query("INSERT INTO users VALUES (1,'alice','Alice',''),(2,'bob','Bob','')");
  await db.query(
    "INSERT INTO sessions VALUES ($1,1,now()+interval '1 day'),($2,2,now()+interval '1 day')",
    [hash('alice'), hash('bob')],
  );
  // Upgrade from an installation without theme storage preserves identities and content.
  await db.query('DROP TABLE blog_themes');
  await migrate(db);
  await migrate(db);
  const app = await createApp({
    db,
    config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://unused' }),
  });
  const req = (method: 'GET' | 'PUT' | 'POST', url: string, payload?: object, session = 'alice') =>
    app.inject({ method, url, payload, cookies: { session }, headers });
  const customized = {
    version: 1,
    palette: 'ocean',
    font: 'sans',
    layout: 'list',
    cover: 'gradient',
  };
  try {
    assert.equal((await app.inject('/api/account/theme')).statusCode, 401);
    assert.equal((await app.inject('/api/blogs/missing')).statusCode, 404);
    assert.deepEqual((await app.inject('/api/blogs/ALICE')).json().blog.theme, defaultBlogTheme);
    assert.equal((await app.inject('/api/blogs/alice')).headers['cache-control'], 'no-store');
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/account/theme',
          payload: customized,
          cookies: { session: 'alice' },
        })
      ).statusCode,
      403,
    );
    for (const invalid of [
      { ...customized, css: 'body{display:none}' },
      { ...customized, palette: 'url(https://evil.invalid)' },
      { ...customized, font: 'https://evil.invalid/font' },
      { ...customized, user_id: 2 },
      { ...customized, version: 2 },
      { palette: 'ocean' },
    ])
      assert.equal((await req('PUT', '/api/account/theme', invalid)).statusCode, 400);
    assert.equal((await req('PUT', '/api/account/theme', customized)).statusCode, 200);
    assert.deepEqual((await req('GET', '/api/account/theme')).json().theme, customized);
    assert.deepEqual((await app.inject('/api/blogs/alice')).json().blog.theme, customized);
    assert.deepEqual(
      (await req('GET', '/api/account/theme', undefined, 'bob')).json().theme,
      defaultBlogTheme,
    );
    const source = (await req('POST', '/api/sources', { name: 'notes', kind: 'upload' })).json()
      .source.id;
    await req('PUT', `/api/sources/${source}/file`, {
      path: 'hello.md',
      content: '# Hello\n\n$E=mc^2$',
    });
    const post = (
      await req('POST', `/api/sources/${source}/publish`, { entries: [{ path: 'hello.md' }] })
    ).json().posts[0].id;
    assert.deepEqual((await app.inject(`/api/posts/${post}`)).json().post.theme, customized);
    await req('PUT', '/api/account/theme', defaultBlogTheme);
    assert.deepEqual((await app.inject(`/api/posts/${post}`)).json().post.theme, defaultBlogTheme);
    await db.query('UPDATE blog_themes SET settings=$1::jsonb WHERE user_id=1', [
      JSON.stringify({ version: 99, css: 'unsafe' }),
    ]);
    assert.deepEqual((await app.inject('/api/blogs/alice')).json().blog.theme, defaultBlogTheme);
    assert.deepEqual(readBlogTheme(null), defaultBlogTheme);
    assert.deepEqual(
      readBlogTheme({ ...customized, cover: 'https://evil.invalid' }),
      defaultBlogTheme,
    );
  } finally {
    await app.close();
    await close();
  }
});
