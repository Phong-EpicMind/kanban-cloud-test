const { test, expect, col, card, addCard } = require('./helpers');
const titles = (page, name) => col(page, name).locator('.card h4').allTextContents();

test('kéo thẻ sang cột khác', async ({ page }) => {
  await card(page, 'Thiết kế trang chủ').dragTo(col(page, 'Xong').locator('.cards'));
  expect(await titles(page, 'Xong')).toEqual(['Thiết kế trang chủ']);
  expect(await titles(page, 'Cần làm')).toEqual(['Chào mừng đến Kanban Pro 👋']);
});
test('kéo thẻ để đổi thứ tự trong cùng cột', async ({ page }) => {
  const list = col(page, 'Cần làm').locator('.cards');
  await card(page, 'Thiết kế trang chủ').dragTo(card(page, 'Chào mừng'), { targetPosition: { x: 20, y: 2 } });
  expect(await titles(page, 'Cần làm')).toEqual(['Thiết kế trang chủ', 'Chào mừng đến Kanban Pro 👋']);
  await expect(list.locator('.card')).toHaveCount(2);
});
test('kéo đổi thứ tự cột', async ({ page }) => {
  await col(page, 'Xong').locator('.col-head').dragTo(col(page, 'Cần làm').locator('.col-head'));
  await expect(page.locator('.column h3')).toHaveText(['Xong', 'Cần làm', 'Đang làm']);
  await page.reload();
  await expect(page.locator('.column h3')).toHaveText(['Xong', 'Cần làm', 'Đang làm']);
});
test('vượt giới hạn WIP thì cảnh báo', async ({ page }) => {
  // cột "Đang làm" có WIP 3 trong dữ liệu mẫu
  for (const t of ['w1', 'w2', 'w3']) await addCard(page, 'Đang làm', t);
  await expect(col(page, 'Đang làm').locator('.count')).not.toHaveClass(/full/);
  await card(page, 'Thiết kế trang chủ').dragTo(col(page, 'Đang làm').locator('.cards'));
  await expect(col(page, 'Đang làm').locator('.count')).toHaveClass(/full/);
  await expect(page.locator('.toast')).toContainText('vượt giới hạn WIP');
});
test('kéo thẻ khi đang lọc không làm mất thẻ', async ({ page }) => {
  await page.locator('#fPrio').selectOption('high');
  await card(page, 'Thiết kế trang chủ').dragTo(col(page, 'Xong').locator('.cards'));
  await page.locator('#fPrio').selectOption('');
  await expect(page.locator('.card')).toHaveCount(2);
  expect(await titles(page, 'Xong')).toEqual(['Thiết kế trang chủ']);
});
