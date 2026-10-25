import { test, expect } from '@playwright/test';

test('English first visit and saved Chinese selection localize the interface, not articles', async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Latest articles' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('link', { name: '文字、公式与慢思考' }).click();
    await expect(page.locator('.markdown-body')).toContainText('文字');
    await expect(page.getByRole('link', { name: 'Back to articles' })).toBeVisible();
    const englishDate = await page.locator('time').innerText();
    await page.getByLabel('Language', { exact: true }).selectOption('zh-CN');
    await expect(page.getByRole('link', { name: '返回文章' })).toBeVisible();
    expect(await page.locator('time').innerText()).not.toBe(englishDate);
    await page.reload();
    await expect(page.getByLabel('语言', { exact: true })).toHaveValue('zh-CN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});

test('dashboard language switch preserves drafts and localizes validation and server errors', async ({
  page,
}) => {
  await page.route(/\/auth\/github$/, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const state = new URL(response.headers().location).searchParams.get('state');
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        location: `${new URL(route.request().url()).origin}/auth/github/callback?code=test&state=${state}`,
      },
    });
  });
  await page.goto('/dashboard');
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await page.getByRole('link', { name: 'Sign in with GitHub ↗', exact: true }).click();
  await page.getByRole('button', { name: 'New source' }).click();
  await page.getByLabel('Source name').fill('中文 workspace');
  await page.getByRole('button', { name: 'Create source →' }).click();
  await expect(page.getByRole('heading', { name: '中文 workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'New text file' }).click();
  await page.getByLabel('Relative file path').fill('draft.md');
  await page.getByLabel('File content').fill('# 原文不会被翻译');
  await page.getByLabel('Language', { exact: true }).selectOption('zh-CN');
  await expect(page.getByLabel('文件内容')).toHaveValue('# 原文不会被翻译');
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved.');
  await page.getByRole('button', { name: '＋ New folder', exact: true }).click();
  await page.getByRole('button', { name: 'Create folder', exact: true }).click();
  expect(
    await page
      .getByLabel('Folder path')
      .evaluate((input: HTMLInputElement) => input.validationMessage),
  ).toBe('Please fill out this field.');
  await page.getByLabel('Folder path').fill('draft.md');
  await page.getByRole('button', { name: 'Create folder', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New folder' }).getByRole('alert')).toContainText(
    'Destination path already exists',
  );
});
