import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { hash } from '../server/auth.js';
import { testDatabase } from './database.js';
import type { Database } from '../server/db.js';
const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused',
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'secret',
});
const headers = { origin: 'http://localhost:5173', 'x-haravatat-request': '1' };
const identity = { id: 1, login: 'alice', name: 'Alice', avatar_url: '' };
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('account deletion verifies self, rolls back failures, cascades data, revokes all sessions and permits empty re-registration', async () => {
  const { db, close } = await testDatabase();
  await db.query("INSERT INTO users VALUES (1,'alice','Alice',''),(2,'bob','Bob','')");
  await db.query(
    "INSERT INTO sessions VALUES ($1,1,now()+interval '1 day'),($2,1,now()+interval '1 day'),($3,2,now()+interval '1 day')",
    [hash('alice'), hash('second'), hash('bob')],
  );
  const source = randomUUID(),
    post = randomUUID(),
    pdf = randomUUID(),
    other = randomUUID();
  await db.query(
    "INSERT INTO sources (id,user_id,name,kind) VALUES ($1,1,'notes','upload'),($2,2,'other','upload')",
    [source, other],
  );
  await db.query("INSERT INTO directories VALUES ($1,'notes')", [source]);
  await db.query("INSERT INTO files VALUES ($1,'notes/a.md',$2)", [source, Buffer.from('file')]);
  await db.query("INSERT INTO file_chunks VALUES ($1,'notes/a.md',0,$2)", [
    source,
    Buffer.from('chunk'),
  ]);
  await db.query('INSERT INTO repository_credentials (source_id,encrypted) VALUES ($1,$2)', [
    source,
    Buffer.from('encrypted'),
  ]);
  await db.query(
    "INSERT INTO posts (id,source_id,entry_path,title,format,content,source_revision) VALUES ($1,$2,'notes/a.md','A','markdown',$3,0),($4,$2,'b.typ','B','typst',$3,0)",
    [post, source, Buffer.from('post'), pdf],
  );
  await db.query("INSERT INTO post_assets VALUES ($1,'a.png',$2,'image/png')", [
    post,
    Buffer.from('image'),
  ]);
  const app = await createApp({
    db,
    config,
    github: {
      async exchange() {
        return identity;
      },
    },
  });
  const remove = (payload: object, session = 'alice', protectedRequest = true) =>
    app.inject({
      method: 'DELETE',
      url: '/api/account',
      payload,
      cookies: { session },
      headers: protectedRequest ? headers : {},
    });
  try {
    assert.equal((await app.inject('/api/account')).statusCode, 401);
    assert.equal((await remove({ confirmation: 'alice' }, 'missing')).statusCode, 401);
    assert.equal((await remove({ confirmation: 'alice' }, 'alice', false)).statusCode, 403);
    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: '/api/account',
          payload: { confirmation: 'alice' },
          cookies: { session: 'alice' },
          headers: { ...headers, origin: 'https://attacker.invalid' },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: '/api/account',
          payload: { confirmation: 'alice' },
          cookies: { session: 'alice' },
          headers: { origin: headers.origin },
        })
      ).statusCode,
      403,
    );
    assert.equal((await remove({ confirmation: 'alice', user_id: 1 }, 'bob')).statusCode, 400);
    assert.equal((await remove({ confirmation: 'alice' }, 'bob')).statusCode, 400);
    assert.equal((await remove({ confirmation: 'wrong' })).statusCode, 400);
    assert.deepEqual(
      (await app.inject({ url: '/api/account', cookies: { session: 'alice' } })).json(),
      { user: { ...identity, id: '1' }, sources: 1, files: 1, posts: 2 },
    );
    await db.query(
      `CREATE FUNCTION reject_file_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'storage failure'; END; $$; CREATE TRIGGER fail_delete BEFORE DELETE ON files FOR EACH ROW EXECUTE FUNCTION reject_file_delete();`,
    );
    const failed = await remove({ confirmation: 'alice' });
    assert.equal(failed.statusCode, 500);
    assert.equal(
      failed.cookies.some((cookie) => cookie.name === 'session'),
      false,
    );
    assert.equal(
      (await app.inject({ url: '/api/me', cookies: { session: 'alice' } })).json().user.login,
      'alice',
    );
    assert.equal((await app.inject(`/api/posts/${post}`)).statusCode, 200);
    assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=1')).rows.length, 2);
    await db.query('DROP TRIGGER fail_delete ON files');
    const deleted = await remove({ confirmation: 'alice' });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.equal(deleted.cookies.find((cookie) => cookie.name === 'session')?.value, '');
    for (const session of ['alice', 'second'])
      assert.equal((await app.inject({ url: '/api/me', cookies: { session } })).json().user, null);
    for (const table of [
      'directories',
      'files',
      'file_chunks',
      'posts',
      'post_assets',
      'repository_credentials',
    ])
      assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length, 0, table);
    assert.equal((await db.query('SELECT * FROM sources')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM users')).rows.length, 1);
    assert.equal(
      (await app.inject({ url: '/api/account', cookies: { session: 'bob' } })).json().user.login,
      'bob',
    );
    for (const url of [
      `/api/posts/${post}`,
      `/api/posts/${pdf}/pdf`,
      `/api/posts/${post}/assets/a.png`,
    ])
      assert.equal((await app.inject(url)).statusCode, 404);
    const start = await app.inject('/auth/github');
    const state = new URL(start.headers.location!).searchParams.get('state')!;
    const finish = await app.inject({
      url: `/auth/github/callback?code=test&state=${state}`,
      cookies: { oauth_state: state },
    });
    const session = finish.cookies.find((cookie) => cookie.name === 'session')!.value;
    const account = (await app.inject({ url: '/api/account', cookies: { session } })).json();
    assert.equal(account.user.login, 'alice');
    assert.equal(account.sources, 0);
    assert.equal(account.posts, 0);
    assert.equal(
      (await app.inject({ url: '/api/me', cookies: { session: 'alice' } })).json().user,
      null,
    );
  } finally {
    await app.close();
    await close();
  }
});

test('in-flight compilation, synchronization and stale source creation cannot repopulate a deleted account', async () => {
  const { db, close } = await testDatabase();
  await db.query("INSERT INTO users VALUES (1,'alice','Alice','')");
  await db.query("INSERT INTO sessions VALUES ($1,1,now()+interval '1 day')", [hash('alice')]);
  const source = randomUUID(),
    repo = randomUUID();
  await db.query(
    "INSERT INTO sources (id,user_id,name,kind,repository,branch) VALUES ($1,1,'typ','upload',NULL,NULL),($2,1,'git','git','https://github.com/alice/notes.git','main')",
    [source, repo],
  );
  await db.query("INSERT INTO files VALUES ($1,'main.typ',$2)", [source, Buffer.from('= Hello')]);
  const compileStarted = gate(),
    syncStarted = gate(),
    createStarted = gate(),
    release = gate();
  let holdCreation = false;
  const wrapped: Database = {
    query: db.query,
    async transaction(work) {
      if (holdCreation) {
        holdCreation = false;
        createStarted.resolve();
        await release.promise;
      }
      return db.transaction(work);
    },
  };
  const app = await createApp({
    db: wrapped,
    config,
    compiler: {
      async compile() {
        compileStarted.resolve();
        await release.promise;
        return Buffer.from('%PDF');
      },
    },
    repositories: {
      async snapshot() {
        syncStarted.resolve();
        await release.promise;
        return {
          commit: 'a'.repeat(40),
          files: [{ path: 'remote.md', content: Buffer.from('# Remote') }],
        };
      },
    },
  });
  const req = (method: 'POST' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, payload, cookies: { session: 'alice' }, headers });
  try {
    const publish = req('POST', `/api/sources/${source}/publish`, {
      entries: [{ path: 'main.typ' }],
    });
    const sync = req('POST', `/api/sources/${repo}/sync`);
    // Fastify injection starts when awaited/then is attached.
    const publishing = Promise.resolve(publish),
      syncing = Promise.resolve(sync);
    await Promise.all([compileStarted.promise, syncStarted.promise]);
    holdCreation = true;
    const creating = Promise.resolve(
      req('POST', '/api/sources', { kind: 'upload', name: 'stale' }),
    );
    await createStarted.promise;
    assert.equal((await req('DELETE', '/api/account', { confirmation: 'alice' })).statusCode, 200);
    // The same GitHub identity returns, while all three old requests remain in flight.
    await db.query("INSERT INTO users VALUES (1,'alice','Alice','')");
    release.resolve();
    assert.equal((await publishing).statusCode, 404);
    assert.equal((await syncing).statusCode, 404);
    assert.equal((await creating).statusCode, 401);
    for (const table of ['sources', 'files', 'posts', 'repository_credentials'])
      assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length, 0, table);
  } finally {
    release.resolve();
    await app.close();
    await close();
  }
});

test('static resources do not consume the API budget while API rate limits remain enforced', async () => {
  const { db, close } = await testDatabase();
  const app = await createApp({ db, config });
  app.get('/assets/example.js', async () => 'script');
  try {
    for (let i = 0; i < 301; i++)
      assert.equal((await app.inject('/assets/example.js')).statusCode, 200);
    for (let i = 0; i < 300; i++) assert.equal((await app.inject('/api/health')).statusCode, 200);
    assert.equal((await app.inject('/api/health')).statusCode, 429);
  } finally {
    await app.close();
    await close();
  }
});
