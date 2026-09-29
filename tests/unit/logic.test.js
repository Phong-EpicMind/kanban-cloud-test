const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../logic.js');

const board = () => {
  const b = L.mkBoard('B', [L.mkCol('A'), L.mkCol('B'), L.mkCol('C')]);
  b.cols[0].cards = ['a1', 'a2', 'a3'].map(t => L.mkCard({ id: t, title: t }));
  b.cols[1].cards = [L.mkCard({ id: 'b1', title: 'b1' })];
  return b;
};
const ids = col => col.cards.map(c => c.id);

test('esc escapes HTML special chars', () => {
  assert.equal(L.esc(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});

test('md: formatting and escaping', () => {
  assert.equal(L.md('**b** *i* `c`'), '<b>b</b> <i>i</i> <code>c</code>');
  assert.equal(L.md('a\nb'), 'a<br>b');
  assert.match(L.md('xem https://ex.com/a ok'), /<a href="https:\/\/ex\.com\/a" target="_blank" rel="noopener">/);
});
test('md: does not let HTML through', () => {
  const out = L.md('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<script'));
  assert.ok(!out.includes('<img'));
});
test('md: URL with quote cannot break out of href', () => {
  const out = L.md('https://x.com/"onmouseover="alert(1)');
  assert.ok(!/href="[^"]*"[^>]*onmouseover=/.test(out));
});

test('hue is deterministic', () => {
  assert.equal(L.hue('bug'), L.hue('bug'));
  assert.notEqual(L.hue('bug'), L.hue('design'));
});

test('matches: text, priority, label', () => {
  const c = L.mkCard({ title: 'Sửa lỗi', desc: 'Đăng nhập', tags: ['bug'], who: 'Phong', prio: 'high' });
  assert.ok(L.matches(c, {}));
  assert.ok(L.matches(c, { q: 'đăng' }));
  assert.ok(L.matches(c, { q: 'phong' }));
  assert.ok(!L.matches(c, { q: 'xyz' }));
  assert.ok(L.matches(c, { fp: 'high' }));
  assert.ok(!L.matches(c, { fp: 'low' }));
  assert.ok(L.matches(c, { fl: 'bug' }));
  assert.ok(!L.matches(c, { fl: 'ui' }));
  assert.ok(!L.matches(c, { q: 'lỗi', fp: 'low' }));
});

test('moveCard: reorder within a column', () => {
  const b = board();
  L.moveCard(b, 'a1', b.cols[0].id, 2, {});
  assert.deepEqual(ids(b.cols[0]), ['a2', 'a3', 'a1']);
});
test('moveCard: across columns at index', () => {
  const b = board();
  L.moveCard(b, 'a2', b.cols[1].id, 0, {});
  assert.deepEqual(ids(b.cols[0]), ['a1', 'a3']);
  assert.deepEqual(ids(b.cols[1]), ['a2', 'b1']);
});
test('moveCard: to empty column and clamps index', () => {
  const b = board();
  L.moveCard(b, 'a1', b.cols[2].id, 99, {});
  assert.deepEqual(ids(b.cols[2]), ['a1']);
  L.moveCard(b, 'a2', b.cols[2].id, -5, {});
  assert.deepEqual(ids(b.cols[2]), ['a2', 'a1']);
});
test('moveCard: unknown card or column changes nothing', () => {
  const b = board(), before = JSON.stringify(b);
  assert.equal(L.moveCard(b, 'nope', b.cols[1].id, 0, {}), null);
  assert.equal(L.moveCard(b, 'a1', 'nope', 0, {}), null);
  assert.equal(JSON.stringify(b), before);
});
test('moveCard: never loses or duplicates cards', () => {
  const b = board();
  for (let i = 0; i < 50; i++) L.moveCard(b, ['a1', 'a2', 'a3', 'b1'][i % 4], b.cols[i % 3].id, i % 4, {});
  assert.deepEqual(b.cols.flatMap(ids).sort(), ['a1', 'a2', 'a3', 'b1']);
});
test('moveCard with active filter drops relative to visible cards', () => {
  const b = board();
  b.cols[0].cards[0].prio = 'high'; b.cols[0].cards[2].prio = 'high';
  b.cols[2].cards = [L.mkCard({ id: 'c1', prio: 'high' }), L.mkCard({ id: 'c2', prio: 'low' }), L.mkCard({ id: 'c3', prio: 'high' })];
  L.moveCard(b, 'a1', b.cols[2].id, 1, { fp: 'high' }); // trước c3 (thẻ hiển thị thứ 2)
  assert.deepEqual(ids(b.cols[2]), ['c1', 'c2', 'a1', 'c3']);
});

test('moveCol: left→right and right→left', () => {
  const b = board(), [a, bb, c] = b.cols.map(x => x.id);
  assert.ok(L.moveCol(b.cols, a, c));
  assert.deepEqual(b.cols.map(x => x.id), [bb, c, a]);
  assert.ok(L.moveCol(b.cols, a, bb));
  assert.deepEqual(b.cols.map(x => x.id), [a, bb, c]);
  assert.equal(L.moveCol(b.cols, a, a), false);
  assert.equal(L.moveCol(b.cols, 'x', a), false);
});

test('sortCards: by due date then priority, undated last', () => {
  const cs = [L.mkCard({ id: '1', due: '' }), L.mkCard({ id: '2', due: '2026-02-01', prio: 'low' }), L.mkCard({ id: '3', due: '2026-02-01', prio: 'high' }), L.mkCard({ id: '4', due: '2026-01-01' })];
  L.sortCards(cs);
  assert.deepEqual(cs.map(c => c.id), ['4', '3', '2', '1']);
});

test('overdue / due today ignore the last column', () => {
  const c = L.mkCard({ due: '2026-01-01' });
  assert.ok(L.isOverdue(c, false, '2026-01-02'));
  assert.ok(!L.isOverdue(c, true, '2026-01-02'));
  assert.ok(!L.isOverdue(L.mkCard(), false));
  assert.ok(L.isDueToday(c, false, '2026-01-01'));
  assert.ok(!L.isDueToday(c, false, '2026-01-02'));
});

test('checkProgress', () => {
  assert.deepEqual(L.checkProgress(L.mkCard()), { done: 0, total: 0, pct: 0 });
  assert.deepEqual(L.checkProgress(L.mkCard({ check: [{ t: 'a', d: true }, { t: 'b', d: false }, { t: 'c', d: false }] })), { done: 1, total: 3, pct: 33 });
});

test('stats', () => {
  const b = board();
  b.cols[0].cards[0].due = '2020-01-01'; b.cols[0].cards[1].prio = 'high';
  b.cols[2].cards = [L.mkCard({ due: '2020-01-01', check: [{ t: 'x', d: true }] })];
  const s = L.stats(b, '2026-01-01');
  assert.equal(s.total, 5);
  assert.equal(s.donePct, 20);
  assert.equal(s.overdue, 1); // thẻ ở cột cuối không tính quá hạn
  assert.equal(s.high, 1);
  assert.deepEqual([s.checkDone, s.checkTotal], [1, 1]);
  assert.deepEqual(s.perCol.map(c => c.n), [3, 1, 1]);
});
test('stats on empty board', () => {
  const s = L.stats(L.mkBoard('x'));
  assert.equal(s.total, 0); assert.equal(s.donePct, 0);
});

test('UndoHistory: undo/redo and limit', () => {
  const h = new L.UndoHistory(3);
  assert.equal(h.undo('x'), null); assert.equal(h.redo('x'), null);
  h.push('s1'); h.push('s2');
  assert.ok(h.canUndo && !h.canRedo);
  assert.equal(h.undo('s3'), 's2');
  assert.ok(h.canRedo);
  assert.equal(h.redo('s2'), 's3');
  h.push('s4'); assert.ok(!h.canRedo, 'push xoá lịch sử redo');
  h.push('a'); h.push('b'); h.push('c');
  assert.equal(h.u.length, 3);
});

test('normalize: rejects garbage', () => {
  for (const bad of [null, {}, { boards: [] }, { boards: 'x' }, { boards: [{ cols: [] }] }, 42]) assert.equal(L.normalize(bad), null);
});
test('normalize: sanitizes hostile imported data', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const s = L.normalize({ accent: 'red;}</style>', cur: 'zzz', boards: [{ id: '"><b>', name: evil, cols: [{ id: 'c"1', title: evil, color: 'url(x)', wip: '<b>', cards: [
    { id: 'k', title: evil, due: evil, prio: 'evil', tags: [evil, ''], check: [{ t: evil, d: 1 }, null], who: evil }] }] }] });
  const c = s.boards[0].cols[0], k = c.cards[0];
  assert.equal(s.accent, '#4f46e5');
  assert.equal(s.cur, s.boards[0].id);
  assert.match(s.boards[0].id, /^[\w-]+$/); assert.match(c.id, /^[\w-]+$/);
  assert.equal(c.color, ''); assert.equal(c.wip, 0);
  assert.equal(k.due, ''); assert.equal(k.prio, 'med');
  assert.deepEqual(k.tags, [evil]); assert.deepEqual(k.check, [{ t: evil, d: true }]);
});
test('normalize: keeps valid data intact', () => {
  const s = L.seed(), n = L.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n, s);
});

test('migrateV1 converts old format', () => {
  const m = L.migrateV1({ cols: [{ title: 'Todo', cards: [{ id: 'x', title: 'T', desc: '', prio: 'high', due: '', tags: ['a'] }] }] });
  assert.equal(m.boards.length, 1);
  assert.equal(m.boards[0].cols[0].cards[0].title, 'T');
  assert.deepEqual(m.boards[0].cols[0].cards[0].check, []);
  assert.equal(L.migrateV1({}), null);
});

test('seed is valid', () => {
  const s = L.seed();
  assert.equal(s.boards[0].cols.length, 3);
  assert.equal(s.cur, s.boards[0].id);
});
