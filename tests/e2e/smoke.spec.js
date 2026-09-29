const { test, expect, col, addCard } = require('./helpers');

test('tải app với dữ liệu mẫu', async ({ page }) => {
  await expect(page).toHaveTitle(/Kanban/);
  await expect(page.locator('.column')).toHaveCount(3);
  await expect(page.locator('.card')).toHaveCount(2);
});
test('thêm nhanh thẻ, lưu và còn sau khi tải lại', async ({ page }) => {
  await addCard(page, 'Đang làm', 'Thẻ mới X');
  await expect(col(page, 'Đang làm').locator('.card')).toContainText('Thẻ mới X');
  await page.reload();
  await expect(col(page, 'Đang làm').locator('.card')).toContainText('Thẻ mới X');
});
test('dữ liệu v1 cũ được nâng cấp', async ({ page }) => {
  await page.evaluate(() => { localStorage.removeItem('kanban.v2'); localStorage.setItem('kanban.v1', JSON.stringify({ cols: [{ id: 'a', title: 'Cũ', cards: [{ id: 'k', title: 'Thẻ cũ', desc: '', prio: 'high', due: '', tags: ['t'] }] }] })); });
  await page.reload();
  await expect(page.locator('.column h3')).toHaveText('Cũ');
  await expect(page.locator('.card')).toContainText('Thẻ cũ');
});
test('dữ liệu hỏng trong localStorage không làm sập app', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('kanban.v2', '{not json'));
  await page.reload();
  await expect(page.locator('.column')).toHaveCount(3);
});
