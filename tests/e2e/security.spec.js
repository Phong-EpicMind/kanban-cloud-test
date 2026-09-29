const { test, expect } = require('./helpers');
const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';

test('nội dung thẻ chứa HTML không được thực thi', async ({ page }) => {
  await page.keyboard.press('n');
  await page.locator('[name=title]').fill(XSS);
  await page.locator('[name=desc]').fill(XSS + ' https://a.com/"onmouseover="window.__xss=1');
  await page.locator('[name=who]').fill(XSS);
  await page.locator('[name=tags]').fill(XSS);
  await page.locator('#checkNew').fill(XSS); await page.locator('#checkNew').press('Enter');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.locator('#statsBtn').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k'); await page.keyboard.type('img'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('.card img, .card script')).toHaveCount(0);
  await expect(page.locator('.card a[onmouseover]')).toHaveCount(0);
});

test('tên bảng/cột độc hại và file nhập độc hại không thực thi', async ({ page }) => {
  const evil = { accent: 'red;}</style><img src=x onerror=window.__xss=1>', cur: '"><img src=x onerror=window.__xss=1>',
    boards: [{ id: '"><img src=x onerror=window.__xss=1>', name: XSS, cols: [{ id: 'q"><img src=x onerror=window.__xss=1>', title: XSS, color: 'red" onmouseover="window.__xss=1', wip: '<img src=x onerror=window.__xss=1>',
      cards: [{ id: 'k', title: XSS, due: '<img src=x onerror=window.__xss=1>', prio: '" onmouseover="window.__xss=1', tags: [XSS], check: [{ t: XSS, d: false }], who: XSS }] }] }] };
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await page.locator('#importFile').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) });
  await page.locator('#statsBtn').click();
  await page.keyboard.press('Escape');
  await page.reload(); // đọc lại từ localStorage
  await page.locator('#statsBtn').click();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});

test('localStorage bị sửa tay bằng dữ liệu độc hại vẫn an toàn', async ({ page }) => {
  await page.evaluate(x => localStorage.setItem('kanban.v2', JSON.stringify({ boards: [{ id: 'b', name: x, cols: [{ id: 'c', title: x, wip: x, cards: [{ id: 'k', title: x, due: x }] }] }] })), XSS);
  await page.reload();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('.card')).toHaveCount(1);
});
