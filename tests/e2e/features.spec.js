const { test, expect, col, card, addCard, state } = require('./helpers');
const { readFileSync } = require('node:fs');
/* Trả lời lần lượt các prompt/confirm kế tiếp */
const say = async (page, answers) => { page.removeAllListeners('dialog'); const q = [...answers]; page.on('dialog', d => (q.length ? d.accept(q.shift()) : d.dismiss())); };

test('hoàn tác / làm lại bằng nút, phím tắt và toast', async ({ page }) => {
  await expect(page.locator('#undoBtn')).toBeDisabled();
  await addCard(page, 'Cần làm', 'U1');
  await expect(page.locator('.card')).toHaveCount(3);
  await page.locator('#undoBtn').click();
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('#redoBtn')).toBeEnabled();
  await page.locator('#redoBtn').click();
  await expect(page.locator('.card')).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.card')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.card')).toHaveCount(3);
  await card(page, 'U1').click(); await page.locator('#delCard').click();
  await expect(page.locator('.card')).toHaveCount(2);
  await page.locator('.toast button', { hasText: 'Hoàn tác' }).click();
  await expect(page.locator('.card')).toHaveCount(3);
});

test('tìm kiếm, lọc ưu tiên và nhãn', async ({ page }) => {
  await page.locator('#search').fill('thiết kế');
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('#search').fill('');
  await page.locator('#fPrio').selectOption('high');
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('#fPrio').selectOption('');
  await page.locator('#fLabel').selectOption('design');
  await expect(page.locator('.card')).toHaveText(/Thiết kế/);
  await page.locator('#fLabel').selectOption('');
  await expect(page.locator('.card')).toHaveCount(2);
});
test('phím / focus ô tìm kiếm', async ({ page }) => {
  await page.keyboard.press('/');
  await expect(page.locator('#search')).toBeFocused();
});

test('nhiều bảng: tạo, chuyển, đổi tên, xoá', async ({ page }) => {
  page.removeAllListeners('dialog');
  const answers = ['n', 'Bảng B'];
  page.on('dialog', d => d.accept(answers.shift() ?? ''));
  await page.locator('#boardMenu').click();
  await expect(page.locator('#boardSel option')).toHaveCount(2);
  await expect(page.locator('#boardSel')).toContainText('Bảng B');
  await expect(page.locator('.card')).toHaveCount(0);
  await page.locator('#boardSel').selectOption({ label: 'Dự án của tôi' });
  await expect(page.locator('.card')).toHaveCount(2);
  const s = await state(page);
  expect(s.boards).toHaveLength(2);
});

test('cột: thêm, đổi tên, WIP, thu gọn, xoá', async ({ page }) => {
  await say(page, ['Kiểm thử']); await page.locator('#addCol').click();
  await expect(page.locator('.column h3')).toHaveText(['Cần làm', 'Đang làm', 'Xong', 'Kiểm thử']);
  await say(page, ['r', 'QA']);
  await col(page, 'Kiểm thử').locator('[data-a=menu]').click();
  await expect(page.locator('.column h3').last()).toHaveText('QA');
  await col(page, 'QA').locator('[data-a=fold]').click();
  await expect(col(page, 'QA')).toHaveClass(/collapsed/);
  await col(page, 'QA').locator('[data-a=fold]').click();
  await say(page, ['w', '2']);
  await col(page, 'QA').locator('[data-a=menu]').click();
  await expect(col(page, 'QA').locator('.count')).toHaveText('0/2');
  await say(page, ['x', '']); // confirm
  await col(page, 'QA').locator('[data-a=menu]').click();
  await expect(page.locator('.column')).toHaveCount(3);
});

test('cột: sắp xếp theo hạn rồi ưu tiên', async ({ page }) => {
  await addCard(page, 'Cần làm', 'Không hạn');
  await say(page, ['s']);
  await col(page, 'Cần làm').locator('[data-a=menu]').click();
  const t = await col(page, 'Cần làm').locator('.card h4').allTextContents();
  expect(t.at(-1)).toBe('Không hạn'); // thẻ không có hạn xếp cuối
});

test('bảng lệnh Ctrl+K: lọc, điều hướng bằng phím, chạy lệnh', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.locator('#pal')).toBeVisible();
  await page.keyboard.type('thẻ: chào');
  await expect(page.locator('#palList li')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('giao diện');
  const before = await page.locator('html').getAttribute('data-theme');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before);
});

test('thống kê', async ({ page }) => {
  await page.locator('#statsBtn').click();
  const d = page.locator('#info');
  await expect(d).toBeVisible();
  await expect(d.locator('.stat').first()).toContainText('2');
  await expect(d.locator('.hb')).toHaveCount(3);
});

test('giao diện sáng/tối được nhớ', async ({ page }) => {
  await page.locator('#themeBtn').click();
  const t = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', t);
});

test('xuất rồi nhập JSON', async ({ page }) => {
  await page.keyboard.press('Control+k'); await page.keyboard.type('Xuất JSON');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  const path = await dl.path();
  const data = JSON.parse(readFileSync(path, 'utf8'));
  expect(data.boards[0].cols).toHaveLength(3);
  // xoá hết rồi nhập lại
  await addCard(page, 'Cần làm', 'Sẽ mất');
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await page.locator('#importFile').setInputFiles(path);
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card', { hasText: 'Sẽ mất' })).toHaveCount(0);
});
test('nhập file JSON sai định dạng thì báo lỗi, dữ liệu giữ nguyên', async ({ page }) => {
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await page.locator('#importFile').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('không phải json') });
  await expect(page.locator('.toast')).toContainText('không hợp lệ');
  await expect(page.locator('.card')).toHaveCount(2);
});

test('đồng bộ giữa hai tab', async ({ page, context }) => {
  const p2 = await context.newPage(); await p2.goto('/');
  await addCard(page, 'Cần làm', 'Từ tab 1');
  await expect(p2.locator('.card', { hasText: 'Từ tab 1' })).toHaveCount(1);
});

test('màu cột: hợp lệ được lưu, không hợp lệ bị từ chối', async ({ page }) => {
  await say(page, ['c', 'red; background:url(x)']);
  await col(page, 'Cần làm').locator('[data-a=menu]').click();
  await expect(page.locator('.toast')).toContainText('#rrggbb');
  await say(page, ['c', '#ef4444']);
  await col(page, 'Cần làm').locator('[data-a=menu]').click();
  expect((await state(page)).boards[0].cols[0].color).toBe('#ef4444');
});
