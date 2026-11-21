// Shared costing / scheduling helpers. Keep byte-identical with apps/web/src/ui/costing.js (pure functions, no imports).
// Node: { id, name, kind, off, dur, dep[], kids[], mat[], labor[], crew }
//  mat:   { item, unit, fixed, perKw, rate }   qty = fixed + perKw * size   (whole units for nos/pairs/m/sets/pcs)
//  labor: { role, fixed, perKw, rate }         man-days = fixed + perKw * size
//  crew:  people working at once; when set, duration (days) = ceil(man-days / crew)
const CEIL_UNITS = ['nos', 'pairs', 'm', 'sets', 'pcs', 'TB'];
const r2 = (n) => Math.round(n * 100) / 100;
export const qtyOf = (m, size) => { const q = (+m.fixed || 0) + (+m.perKw || 0) * size; return CEIL_UNITS.includes(m.unit) ? Math.ceil(q - 1e-9) : r2(q); };
export const matCost = (m, size) => qtyOf(m, size) * (+m.rate || 0);
export const mdOf = (l, size) => r2((+l.fixed || 0) + (+l.perKw || 0) * size);
export const labCost = (l, size) => mdOf(l, size) * (+l.rate || 0);

export function own(n, size) {
  const mat = (n.mat || []).reduce((s, m) => s + matCost(m, size), 0);
  const lab = (n.labor || []).reduce((s, l) => s + labCost(l, size), 0);
  const md = (n.labor || []).reduce((s, l) => s + mdOf(l, size), 0);
  return { mat, lab, md };
}
export function roll(n, size) {
  const t = own(n, size);
  for (const k of n.kids || []) { const x = roll(k, size); t.mat += x.mat; t.lab += x.lab; t.md += x.md; }
  return t;
}
export const rollAll = (nodes, size) => nodes.reduce((t, n) => { const x = roll(n, size); return { mat: t.mat + x.mat, lab: t.lab + x.lab, md: t.md + x.md }; }, { mat: 0, lab: 0, md: 0 });

export const crewDays = (n, size) => (n.crew > 0 && (n.labor || []).length ? Math.max(1, Math.ceil(own(n, size).md / n.crew - 1e-9)) : null);
export function applySize(nodes, size) {
  (function w(a) { for (const n of a) { const d = crewDays(n, size); if (d != null && n.kind !== 'milestone') n.dur = d; w(n.kids || []); } })(nodes);
  return nodes;
}
// Forward pass: a node starts after its predecessors end (or at its parent's start). Parents roll up from children.
export function autoSchedule(nodes) {
  const end = new Map();
  const sched = (n, floor) => {
    let s = floor;
    for (const d of n.dep || []) if (end.has(String(d))) s = Math.max(s, end.get(String(d)));
    n.off = s;
    if (!(n.kids || []).length) { const e = s + (n.kind === 'milestone' ? 0 : (+n.dur || 0)); end.set(String(n.id), e); return e; }
    let e = s; for (const k of n.kids) e = Math.max(e, sched(k, s));
    end.set(String(n.id), e); return e;
  };
  nodes.forEach((n) => sched(n, 0));
  return nodes;
}

const walk = (nodes, fn) => { for (const n of nodes) { fn(n); walk(n.kids || [], fn); } };
export function bom(nodes, size) {
  const m = new Map();
  walk(nodes, (n) => (n.mat || []).forEach((x) => {
    const k = `${x.item}|${x.unit}|${x.rate}`; const q = qtyOf(x, size);
    const cur = m.get(k) || { item: x.item, unit: x.unit, rate: +x.rate || 0, qty: 0 };
    cur.qty = r2(cur.qty + q); m.set(k, cur);
  }));
  return [...m.values()].map((x) => ({ ...x, amount: x.qty * x.rate })).sort((a, b) => b.amount - a.amount);
}
export function manpower(nodes, size) {
  const m = new Map();
  walk(nodes, (n) => (n.labor || []).forEach((l) => {
    const cur = m.get(l.role) || { role: l.role, md: 0, cost: 0, rate: +l.rate || 0 };
    cur.md = r2(cur.md + mdOf(l, size)); cur.cost += labCost(l, size); m.set(l.role, cur);
  }));
  return [...m.values()].sort((a, b) => b.cost - a.cost);
}
// params: { overhead %, gstGoods %, gstServices %, subsidy: { label, tiers: [[kw, ₹/kW], ...] } }
export function estimate(nodes, size, p = {}) {
  const t = rollAll(nodes, size);
  const ov = (+p.overhead || 0) / 100;
  const goods = t.mat * (1 + ov), services = t.lab * (1 + ov);
  const overhead = (t.mat + t.lab) * ov;
  const gst = goods * ((+p.gstGoods || 0) / 100) + services * ((+p.gstServices || 0) / 100);
  const total = t.mat + t.lab + overhead + gst;
  let subsidy = 0, left = size;
  for (const [kw, rate] of p.subsidy?.tiers || []) { const u = Math.min(left, kw); if (u > 0) subsidy += u * rate; left -= u; }
  return { materials: t.mat, labour: t.lab, md: t.md, overhead, gst, total, subsidy, net: total - subsidy };
}
