import { test, expect } from '@playwright/test';
test('private theme previews publish consistently to blog and articles while site tools and other authors stay isolated', async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  await page.route(/\/auth\/github$/, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const state = new URL(response.headers().location).searchParams.get('state');
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        location: `${new URL(route.request().url()).origin}/auth/github/callback?code=theme-test&state=${state}`,
      },
    });
  });
  await page.goto('/account/theme');
  await page.locator('main').getByRole('link', { name: '请先通过 GitHub 登录' }).click();
  const origin = new URL(page.url()).origin;
  const headers = { Origin: origin, 'X-Haravatat-Request': '1' };
  const sourceResponse = await page.request.post('/api/sources', {
    headers,
    data: { kind: 'upload', name: 'Themed source' },
  });
  expect(sourceResponse.ok()).toBe(true);
  const source = (await sourceResponse.json()).source.id;
  await page.request.put(`/api/sources/${source}/file`, {
    headers,
    data: {
      path: 'theme.md',
      content:
        '# Theme article\n\n[TOC]\n\n## 数学章节\n\n$$ E = mc^2 $$\n\n## Last chapter\n\nText',
    },
  });
  await page.request.put(`/api/sources/${source}/file`, {
    headers,
    data: { path: 'theme.typ', content: '= Themed PDF\n$ E = m c^2 $' },
  });
  const published = await page.request.post(`/api/sources/${source}/publish`, {
    headers,
    data: { entries: [{ path: 'theme.md' }, { path: 'theme.typ' }] },
  });
  expect(published.ok(), await published.text()).toBe(true);
  const [markdown, pdf] = (await published.json()).posts;
  await page.getByRole('link', { name: '账号管理', exact: true }).click();
  await page.getByRole('link', { name: '博客主题', exact: true }).click();
  await expect(page.getByLabel('配色', { exact: true })).toBeEnabled();
  const siteColor = await page
    .locator('.site-header')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.getByLabel('配色', { exact: true }).selectOption('ocean');
  await page.getByLabel('阅读字体', { exact: true }).selectOption('sans');
  await page.getByLabel('首页布局', { exact: true }).selectOption('list');
  await page.getByLabel('封面', { exact: true }).selectOption('gradient');
  const preview = page.getByRole('region', { name: '主题预览', exact: true });
  await expect(preview).toHaveAttribute('data-blog-palette', 'ocean');
  await expect(preview.locator('.katex')).toHaveCount(1);
  expect((await page.request.get('/api/blogs/theme-writer')).ok()).toBe(true);
  expect(
    (await (await page.request.get('/api/blogs/theme-writer')).json()).blog.theme.palette,
  ).toBe('forest');
  await page.route('**/api/account/theme', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({ status: 500, json: { error: '服务器处理失败，请稍后重试' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: '保存主题', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('服务器处理失败');
  await expect(preview).toHaveAttribute('data-blog-palette', 'ocean');
  await page.unroute('**/api/account/theme');
  await page.getByRole('button', { name: '保存主题', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('博客主题已保存');
  expect(
    await page.locator('.site-header').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe(siteColor);
  await page.reload();
  await expect(page.getByLabel('配色', { exact: true })).toHaveValue('ocean');
  await page.getByRole('button', { name: '恢复默认预览', exact: true }).click();
  await expect(preview).toHaveAttribute('data-blog-palette', 'forest');
  expect(
    (await (await page.request.get('/api/blogs/theme-writer')).json()).blog.theme.palette,
  ).toBe('ocean');
  await page.getByRole('button', { name: '撤销预览修改', exact: true }).click();
  await expect(preview).toHaveAttribute('data-blog-palette', 'ocean');
  const visitor = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 390, height: 844 },
  });
  const reading = await visitor.newPage();
  try {
    await reading.goto('/?author=theme-writer');
    await expect(reading.locator('main')).toHaveAttribute('data-blog-palette', 'ocean');
    await expect(reading.locator('main')).toHaveAttribute('data-blog-layout', 'list');
    expect(
      await reading
        .locator('.post-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    ).toBe(1);
    await reading.goto(`/p/${markdown.id}`);
    await expect(reading.locator('main')).toHaveAttribute('data-blog-font', 'sans');
    await expect(reading.locator('.katex')).toHaveCount(1);
    await reading.locator('.article-outline summary').click();
    await expect(reading.getByRole('navigation', { name: '侧栏目录' })).toBeVisible();
    await reading.getByLabel('显示模式', { exact: true }).selectOption('dark');
    await reading.getByLabel('语言', { exact: true }).selectOption('en');
    await expect(reading.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(reading.locator('.markdown-body')).toContainText('数学章节');
    expect(
      await reading
        .locator('main')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--green').trim()),
    ).toBe('#92cef4');
    expect(await reading.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await reading.screenshot({ path: 'test-results/themed-mobile-article.png', fullPage: true });
    await reading.goto(`/p/${pdf.id}`);
    await expect(reading.locator('.pdf-page canvas')).toBeVisible();
    expect(
      await reading
        .locator('.pdf-page')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(255, 255, 255)');
    await reading.goto('/?author=writer');
    await expect(reading.locator('main')).toHaveAttribute('data-blog-palette', 'forest');
    await reading.goto('/dashboard');
    await expect(reading.locator('.blog-theme')).toHaveCount(0);
  } finally {
    await visitor.close();
  }
  await page.getByRole('button', { name: '恢复默认预览', exact: true }).click();
  await page.getByRole('button', { name: '保存主题', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('博客主题已保存');
  expect(
    (await (await page.request.get(`/api/posts/${markdown.id}`)).json()).post.theme.palette,
  ).toBe('forest');
  await page.screenshot({ path: 'test-results/theme-preview.png', fullPage: true });
});
