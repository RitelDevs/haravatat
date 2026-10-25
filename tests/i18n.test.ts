import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preferredLanguage, translate, translateMessage } from '../shared/i18n.js';

test('language fallback and message parameters preserve paths and diagnostics', () => {
  assert.equal(preferredLanguage('fr-FR,en-US;q=0.9'), 'en');
  assert.equal(preferredLanguage('de-DE'), 'zh-CN');
  assert.equal(preferredLanguage('en;q=0,zh-CN;q=0.8'), 'zh-CN');
  assert.equal(translate('尚未翻译', [], 'en'), '尚未翻译');
  assert.equal(translate('发布 {0}', ['中文/a.md'], 'en'), 'Publish 中文/a.md');
  assert.equal(
    translateMessage('入口不是有效的 Typst / Markdown 文件：中文/a.md', 'en'),
    'Entry is not a valid Typst / Markdown file: 中文/a.md',
  );
  assert.equal(
    translateMessage('Typst 编译失败：line 1\nunknown variable', 'en'),
    'Typst compilation failed: line 1\nunknown variable',
  );
  assert.equal(
    translateMessage(
      'Files uploaded. Select entries and publish to update public articles.',
      'zh-CN',
    ),
    '文件已上传。勾选入口后发布，线上文章才会更新。',
  );
});

test('HTTP errors use requested language while retaining protection and status codes', async () => {
  const { createApp } = await import('../server/app.js');
  const { loadConfig } = await import('../server/config.js');
  const { testDatabase } = await import('./database.js');
  const { db, close } = await testDatabase();
  const app = await createApp({
    db,
    config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://unused' }),
  });
  try {
    const english = await app.inject({
      url: '/api/sources',
      headers: { 'accept-language': 'en-US' },
    });
    assert.equal(english.statusCode, 401);
    assert.equal(english.json().error, 'Please sign in with GitHub first');
    const fallback = await app.inject({
      url: '/api/sources',
      headers: { 'accept-language': 'fr-FR' },
    });
    assert.equal(fallback.json().error, '请先通过 GitHub 登录');
    const protectedRequest = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { 'accept-language': 'en' },
    });
    assert.equal(protectedRequest.statusCode, 403);
    assert.equal(protectedRequest.json().error, 'Invalid request origin');
  } finally {
    await app.close();
    await close();
  }
});
