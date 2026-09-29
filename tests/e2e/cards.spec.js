const { test, expect, col, card, addCard, state } = require('./helpers');

test.describe('thẻ', () => {
  test('tạo thẻ đầy đủ qua hộp thoại (phím n)', async ({ page }) => {
    await page.keyboard.press('n');
    const f = page.locator('#cardForm');
    await f.locator('[name=title]').fill('Viết báo cáo');
    await f.locator('[name=desc]').fill('**quan trọng** xem https://example.com');
    await f.locator('[name=prio]').selectOption('high');
    await f.locator('[name=due]').fill('2099-12-31');
    await f.locator('[name=who]').fill('Phong');
    await f.locator('[name=tags]').fill('docs, urgent');
    await f.locator('[name=col]').selectOption({ label: 'Đang làm' });
    await f.getByRole('button', { name: 'Lưu', exact: true }).click();
    const c = col(page, 'Đang làm').locator('.card', { hasText: 'Viết báo cáo' });
    await expect(c).toHaveAttribute('data-prio', 'high');
    await expect(c.locator('b')).toHaveText('quan trọng');
    await expect(c.locator('a')).toHaveAttribute('href', 'https://example.com');
    await expect(c.locator('.tag')).toHaveText(['docs', 'urgent']);
    await expect(c.locator('.av')).toHaveText('PH');
    await expect(c).toContainText('2099-12-31');
  });

  test('sửa và chuyển cột', async ({ page }) => {
    await card(page, 'Thiết kế trang chủ').click();
    await page.locator('[name=title]').fill('Trang chủ v2');
    await page.locator('[name=col]').selectOption({ label: 'Xong' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(col(page, 'Xong').locator('.card')).toContainText('Trang chủ v2');
  });

  test('không lưu thẻ có tiêu đề trống', async ({ page }) => {
    await page.keyboard.press('n');
    await page.locator('[name=title]').fill('   ');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.locator('.card')).toHaveCount(2);
  });

  test('checklist: thêm, tick, xoá, tiến độ', async ({ page }) => {
    await card(page, 'Thiết kế trang chủ').click();
    for (const t of ['a', 'b', 'c', 'd']) { await page.locator('#checkNew').fill(t); await page.locator('#checkNew').press('Enter'); }
    await page.locator('#checkList .ci input').nth(0).check();
    await page.locator('#checkList .ci .x').nth(3).click();
    await expect(page.locator('#checkPct')).toHaveText('(33%)');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    const c = card(page, 'Thiết kế trang chủ');
    await expect(c).toContainText('☑ 1/3');
    await expect(c.locator('.bar i')).toHaveAttribute('style', /width:\s*33%/);
  });

  test('nhân bản, lưu trữ và khôi phục, xoá', async ({ page }) => {
    await card(page, 'Thiết kế trang chủ').click();
    await page.locator('#dupCard').click();
    await expect(page.locator('.card', { hasText: 'Thiết kế trang chủ' })).toHaveCount(2);
    await card(page, '(bản sao)').click();
    await page.locator('#arcCard').click();
    await expect(page.locator('.card', { hasText: '(bản sao)' })).toHaveCount(0);
    expect((await state(page)).boards[0].archive).toHaveLength(1);
    await page.keyboard.press('Control+k'); await page.keyboard.type('Lưu trữ'); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Khôi phục' }).click();
    await expect(page.locator('.card', { hasText: '(bản sao)' })).toHaveCount(1);
    await card(page, '(bản sao)').click();
    await page.locator('#delCard').click();
    await expect(page.locator('.card', { hasText: '(bản sao)' })).toHaveCount(0);
  });

  test('thẻ quá hạn hiện màu cảnh báo, trừ cột cuối', async ({ page }) => {
    await addCard(page, 'Cần làm', 'Trễ');
    await card(page, 'Trễ').click();
    await page.locator('[name=due]').fill('2000-01-01');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(card(page, 'Trễ').locator('.overdue')).toHaveCount(1);
    await card(page, 'Trễ').click();
    await page.locator('[name=col]').selectOption({ label: 'Xong' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(card(page, 'Trễ').locator('.overdue')).toHaveCount(0);
  });

  test('mở thẻ bằng bàn phím (Enter)', async ({ page }) => {
    await card(page, 'Thiết kế trang chủ').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dlg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dlg')).not.toBeVisible();
  });
});
