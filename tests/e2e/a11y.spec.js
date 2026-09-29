const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, card } = require('./helpers');

const scan = async page => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations
  .map(v => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0].target}`);

for (const theme of ['light', 'dark']) {
  test(`bảng chính không vi phạm WCAG AA (${theme})`, async ({ page }) => {
    await page.evaluate(t => localStorage.setItem('kanban.theme', t), theme);
    await page.reload();
    expect(await scan(page)).toEqual([]);
  });
  test(`hộp thoại thẻ không vi phạm WCAG AA (${theme})`, async ({ page }) => {
    await page.evaluate(t => localStorage.setItem('kanban.theme', t), theme);
    await page.reload();
    await card(page, 'Thiết kế trang chủ').click();
    expect(await scan(page)).toEqual([]);
  });
}
test('thống kê và bảng lệnh không vi phạm', async ({ page }) => {
  await page.locator('#statsBtn').click();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  expect(await scan(page)).toEqual([]);
});
