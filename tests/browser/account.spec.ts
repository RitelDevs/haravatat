import { test, expect } from '@playwright/test';
test('account confirmation cancels safely, handles failure and deletes only the signed-in account', async ({
  page,
}) => {
  await page.route(/\/auth\/github$/, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const state = new URL(response.headers().location).searchParams.get('state');
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        location: `${new URL(route.request().url()).origin}/auth/github/callback?code=account-test&state=${state}`,
      },
    });
  });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: '账号管理' })).toBeVisible();
  await page.locator('main').getByRole('link', { name: 'GitHub 登录' }).click();
  await page.getByRole('button', { name: '＋ 新建来源', exact: true }).click();
  await page.getByLabel('来源名称').fill('Delete me');
  await page.getByRole('button', { name: '创建来源 →' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: '账号管理', exact: true }).click();
  await expect(page.getByText('account-writer', { exact: true })).toBeVisible();
  await expect(page.getByText('本站数据：1 个工作区，0 个文件，0 篇文章。')).toBeVisible();
  let deletes = 0;
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && request.url().endsWith('/api/account')) deletes++;
  });
  await page.getByRole('button', { name: '注销本站账号', exact: true }).click();
  await page.getByLabel('确认用户名', { exact: true }).fill('wrong');
  await expect(page.getByRole('button', { name: '永久删除本站账号', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(deletes).toBe(0);
  await page.getByRole('button', { name: '注销本站账号', exact: true }).click();
  await page.getByLabel('确认用户名', { exact: true }).fill('account-writer');
  await page.route('**/api/account', async (route) => {
    if (route.request().method() === 'DELETE')
      await route.fulfill({ status: 500, json: { error: '服务器处理失败，请稍后重试' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: '永久删除本站账号', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('服务器处理失败');
  await expect(page.getByLabel('确认用户名', { exact: true })).toHaveValue('account-writer');
  await page.unroute('**/api/account');
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await page
    .getByRole('button', { name: 'Permanently delete my site account', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Your site account and associated data have been deleted.',
  );
  await expect(page.getByRole('link', { name: 'Account settings', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Sign in with GitHub', exact: true }).click();
  await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await expect(page.getByText('Site data: 0 sources, 0 files, 0 articles.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
