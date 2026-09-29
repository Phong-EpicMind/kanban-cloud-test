'use strict';
/* Logic thuần (không đụng DOM) — dùng trong trình duyệt qua biến toàn cục KanbanLogic và trong Node qua require(). */
(function (root) {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const PRIOS = ['low', 'med', 'high'];
  const mkCard = (o = {}) => ({ id: uid(), title: '', desc: '', prio: 'med', due: '', tags: [], check: [], who: '', created: today(), ...o });
  const mkCol = (title, o = {}) => ({ id: uid(), title, color: '', wip: 0, collapsed: false, cards: [], ...o });
  const mkBoard = (name, cols) => ({ id: uid(), name, archive: [], cols: cols || [mkCol('Cần làm'), mkCol('Đang làm'), mkCol('Xong')] });

  function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 60% 45%)`; }

  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  }

  /* filters = {q, fp, fl}; q đã viết thường */
  function matches(c, { q = '', fp = '', fl = '' } = {}) {
    return (!fp || c.prio === fp) && (!fl || c.tags.includes(fl)) &&
      (!q || (c.title + ' ' + c.desc + ' ' + c.tags.join(' ') + ' ' + c.who).toLowerCase().includes(q));
  }
  const isFiltering = f => !!(f && (f.q || f.fp || f.fl));

  /* Chuyển thẻ sang cột đích tại vị trí idx (tính theo các thẻ đang hiển thị). Trả về cột đích hoặc null. */
  function moveCard(board, id, toCol, idx, filters) {
    const dest = board.cols.find(c => c.id === toCol);
    if (!dest) return null;
    let card;
    for (const c of board.cols) { const i = c.cards.findIndex(x => x.id === id); if (i >= 0) { card = c.cards.splice(i, 1)[0]; break; } }
    if (!card) return null;
    let at = dest.cards.length;
    if (!isFiltering(filters)) at = Math.max(0, Math.min(idx, dest.cards.length));
    else { const ref = dest.cards.filter(c => matches(c, filters))[idx]; at = ref ? dest.cards.indexOf(ref) : dest.cards.length; }
    dest.cards.splice(at, 0, card);
    return dest;
  }

  /* Đưa cột id tới vị trí của cột target. */
  function moveCol(cols, id, target) {
    const from = cols.findIndex(c => c.id === id), to = cols.findIndex(c => c.id === target);
    if (from < 0 || to < 0 || from === to) return false;
    cols.splice(to, 0, cols.splice(from, 1)[0]);
    return true;
  }

  function sortCards(cards) {
    const p = { high: 0, med: 1, low: 2 };
    cards.sort((a, b) => { const x = a.due || '9', y = b.due || '9'; return x < y ? -1 : x > y ? 1 : p[a.prio] - p[b.prio]; });
  }

  const isOverdue = (c, isLast, t = today()) => !!(c.due && !isLast && c.due < t);
  const isDueToday = (c, isLast, t = today()) => !!(c.due && !isLast && c.due === t);
  const checkProgress = c => { const done = c.check.filter(x => x.d).length; return { done, total: c.check.length, pct: c.check.length ? Math.round(done / c.check.length * 100) : 0 }; };

  function stats(board, t = today()) {
    const all = board.cols.flatMap(c => c.cards), last = board.cols.at(-1)?.cards.length || 0;
    const items = all.flatMap(c => c.check);
    return {
      total: all.length,
      donePct: all.length ? Math.round(last / all.length * 100) : 0,
      overdue: board.cols.slice(0, -1).flatMap(c => c.cards).filter(c => c.due && c.due < t).length,
      high: all.filter(c => c.prio === 'high').length,
      checkDone: items.filter(x => x.d).length, checkTotal: items.length,
      perCol: board.cols.map(c => ({ title: c.title, n: c.cards.length })),
    };
  }

  /* Làm sạch dữ liệu (từ localStorage / file nhập) để không thể chèn HTML hay làm hỏng render. */
  const str = (v, max = 5000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const safeId = v => str(v, 40).replace(/[^\w-]/g, '') || uid();
  function normCard(k) {
    k = k && typeof k === 'object' ? k : {};
    return {
      id: safeId(k.id), title: str(k.title, 140), desc: str(k.desc), prio: PRIOS.includes(k.prio) ? k.prio : 'med',
      due: /^\d{4}-\d{2}-\d{2}$/.test(k.due) ? k.due : '', who: str(k.who, 60),
      tags: Array.isArray(k.tags) ? k.tags.map(t => str(t, 40)).filter(Boolean) : [],
      check: Array.isArray(k.check) ? k.check.filter(x => x && typeof x === 'object').map(x => ({ t: str(x.t, 300), d: !!x.d })) : [],
      created: /^\d{4}-\d{2}-\d{2}$/.test(k.created) ? k.created : today(),
      ...(k.from != null ? { from: str(k.from, 100) } : {}),
    };
  }
  function normalize(s) {
    if (!s || !Array.isArray(s.boards) || !s.boards.length) return null;
    const boards = s.boards.filter(b => b && typeof b === 'object').map(b => ({
      id: safeId(b.id), name: str(b.name, 100) || 'Bảng', archive: (Array.isArray(b.archive) ? b.archive : []).map(normCard),
      cols: (Array.isArray(b.cols) ? b.cols : []).filter(c => c && typeof c === 'object').map(c => ({
        id: safeId(c.id), title: str(c.title, 100), color: /^#[0-9a-f]{3,8}$/i.test(c.color) ? c.color : '',
        wip: Number.isInteger(c.wip) && c.wip > 0 ? c.wip : 0, collapsed: !!c.collapsed,
        cards: (Array.isArray(c.cards) ? c.cards : []).map(normCard),
      })),
    })).filter(b => b.cols.length);
    if (!boards.length) return null;
    return { boards, cur: boards.some(b => b.id === s.cur) ? s.cur : boards[0].id, accent: /^#[0-9a-f]{3,8}$/i.test(s.accent) ? s.accent : '#4f46e5' };
  }
  /* Nâng cấp từ dữ liệu v1 ({cols:[…]}). */
  function migrateV1(old) {
    if (!old || !Array.isArray(old.cols)) return null;
    const b = mkBoard('Bảng 1', old.cols.map(c => mkCol(str(c.title, 100), { cards: (c.cards || []).map(normCard) })));
    return { boards: [b], cur: b.id, accent: '#4f46e5' };
  }
  function seed() {
    const b = mkBoard('Dự án của tôi', [mkCol('Cần làm', { color: '#4f46e5' }), mkCol('Đang làm', { color: '#f59e0b', wip: 3 }), mkCol('Xong', { color: '#22c55e' })]);
    b.cols[0].cards = [
      mkCard({ title: 'Chào mừng đến Kanban Pro 👋', desc: 'Kéo thả thẻ & cột. Nhấn **Ctrl+K** mở bảng lệnh, **?** xem phím tắt.', tags: ['hướng dẫn'], check: [{ t: 'Thử kéo thẻ', d: false }, { t: 'Mở thống kê 📊', d: false }] }),
      mkCard({ title: 'Thiết kế trang chủ', prio: 'high', due: today(), tags: ['design'], who: 'Phong' })];
    return { boards: [b], cur: b.id, accent: '#4f46e5' };
  }

  /* Lịch sử hoàn tác/làm lại dựa trên ảnh chụp JSON. */
  class UndoHistory {
    constructor(limit = 100) { this.limit = limit; this.u = []; this.r = []; }
    push(snap) { this.u.push(snap); if (this.u.length > this.limit) this.u.shift(); this.r = []; }
    undo(cur) { if (!this.u.length) return null; this.r.push(cur); return this.u.pop(); }
    redo(cur) { if (!this.r.length) return null; this.u.push(cur); return this.r.pop(); }
    get canUndo() { return this.u.length > 0; }
    get canRedo() { return this.r.length > 0; }
  }

  const api = { uid, esc, today, mkCard, mkCol, mkBoard, hue, md, matches, isFiltering, moveCard, moveCol, sortCards, isOverdue, isDueToday, checkProgress, stats, normalize, migrateV1, seed, UndoHistory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KanbanLogic = api;
})(typeof self !== 'undefined' ? self : globalThis);
