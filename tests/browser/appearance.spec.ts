import { test, expect } from '@playwright/test';

test('display preference follows the system, persists and keeps PDF paper white', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('显示模式').selectOption('light');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByLabel('显示模式')).toHaveValue('light');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('显示模式').selectOption('system');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('显示模式').selectOption('dark');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: '文字、公式与慢思考' }).click();
  await expect(page.locator('.markdown-body pre')).toBeVisible();
  await expect(page.locator('.markdown-body')).toHaveCSS('color', 'rgb(228, 236, 229)');
  await page.goto('/');
  await page.getByRole('link', { name: '关于知识的边界' }).click();
  await expect(page.locator('.pdf-page').first()).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('显示模式')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('display mode remains usable when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('显示模式').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
