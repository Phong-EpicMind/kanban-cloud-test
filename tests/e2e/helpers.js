const { test: base, expect } = require('@playwright/test');

/* Mỗi test bắt đầu với localStorage sạch + bắt lỗi JS/console. */
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss()); // mặc định huỷ prompt/confirm bất ngờ
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await use(page);
    expect(errors, 'không có lỗi JS').toEqual([]);
  },
});

const col = (page, name) => page.locator('.column', { has: page.locator('h3', { hasText: new RegExp(`^${name}$`) }) });
const card = (page, title) => page.locator('.card', { hasText: title });
async function addCard(page, colName, title) {
  await col(page, colName).locator('.add-card').click();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('kanban.v2')));
/* Trả lời prompt() kế tiếp */
const answerPrompt = (page, value) => page.once('dialog', d => d.accept(value));
module.exports = { test, expect, col, card, addCard, state, answerPrompt };
