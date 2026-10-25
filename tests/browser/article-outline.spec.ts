import { test, expect } from '@playwright/test';
import { renderMarkdown } from '../../server/markdown.js';

test('sidebar shares heading anchors, tracks scrolling and collapses on mobile', async ({
  page,
}) => {
  const content = [
    '# 中文 **标题**',
    '[TOC]',
    '## 重复标题',
    ...Array.from({ length: 30 }, (_, i) => `正文 ${i}`),
    '#### 带格式的 *章节*',
    ...Array.from({ length: 30 }, (_, i) => `中段 ${i}`),
    '## 重复标题',
    ...Array.from({ length: 30 }, (_, i) => `尾段 ${i}`),
    '脚注[^n]',
    '[^n]: 脚注内容',
  ].join('\n\n');
  const snapshot = renderMarkdown(
    [{ path: 'main.md', content: Buffer.from(content) }],
    'main.md',
    'outline',
    new Map(),
  );
  await page.route('**/api/posts/outline', (route) =>
    route.fulfill({
      json: {
        post: {
          id: 'outline',
          title: '测试目录',
          format: 'markdown',
          markdown: snapshot.content.toString(),
          published_at: '2026-10-25T00:00:00Z',
          name: 'Writer',
          login: 'writer',
          avatar_url: 'https://avatars.githubusercontent.com/u/101',
          source_name: 'notes',
        },
      },
    }),
  );
  await page.goto('/p/outline');
  const sidebar = page.getByRole('navigation', { name: '侧栏目录' });
  const inline = page.getByRole('navigation', { name: '文章目录' });
  await expect(sidebar.getByRole('link')).toHaveCount(4);
  expect(
    await sidebar
      .getByRole('link')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
  ).toEqual(
    await inline
      .getByRole('link')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
  );
  await expect(sidebar.locator('ol ol ol')).toHaveCount(1);
  await sidebar.getByRole('link', { name: '重复标题', exact: true }).last().click();
  const last = page
    .locator('.markdown-body h2')
    .filter({ hasText: /^重复标题$/ })
    .last();
  await expect
    .poll(() => last.evaluate((el) => Math.abs(el.getBoundingClientRect().top - 24) < 2))
    .toBe(true);
  await expect(sidebar.getByRole('link', { name: '重复标题', exact: true }).last()).toHaveAttribute(
    'aria-current',
    'location',
  );
  await page.locator('.markdown-body h4').evaluate((el) => el.scrollIntoView());
  await expect(sidebar.getByRole('link', { name: '带格式的 章节' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/p/outline');
  await expect(sidebar).toBeHidden();
  const summary = page.locator('.article-outline summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('link', { name: '重复标题', exact: true }).last().focus();
  await page.keyboard.press('Enter');
  await expect(sidebar).toBeHidden();
  await expect(summary).toBeFocused();
  await expect
    .poll(() =>
      last.evaluate(
        (el) => el.getBoundingClientRect().top >= 68 && el.getBoundingClientRect().top < 80,
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      last.evaluate(
        (el) => el.getBoundingClientRect().top >= 68 && el.getBoundingClientRect().top < 80,
      ),
    )
    .toBe(true);
});

test('articles without headings omit the sidebar', async ({ page }) => {
  await page.route('**/api/posts/plain', (route) =>
    route.fulfill({
      json: {
        post: {
          id: 'plain',
          title: 'Plain',
          format: 'markdown',
          markdown: 'A paragraph.',
          published_at: '2026-10-25T00:00:00Z',
          name: 'Writer',
          login: 'writer',
          avatar_url: 'https://avatars.githubusercontent.com/u/101',
          source_name: 'notes',
        },
      },
    }),
  );
  await page.goto('/p/plain');
  await expect(page.locator('.markdown-body')).toHaveText('A paragraph.');
  await expect(page.locator('.article-outline')).toHaveCount(0);
});
