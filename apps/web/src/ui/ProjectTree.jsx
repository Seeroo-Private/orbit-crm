import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Flag, GripVertical, Layers, LayoutGrid, Link2, Package, Pencil, Plus, Trash2, ChevronsUpDown, Check, Box } from 'lucide-react';
import { Modal, Input, Select, Textarea } from './kit.jsx';
import { dateFmt, compact } from '../api.js';
import { own, roll, matCost, labCost, crewDays } from './costing.js';

// ---------- pure helpers shared by project / template / wizard screens ----------
export const LV0 = ['Phase', 'Module', 'Component', 'Sub-component'];
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const newId = () => `x${Math.random().toString(36).slice(2, 9)}`;
export const same = (a, b) => String(a) === String(b);
export const span = (n) => {
  if (!n.kids?.length) return [n.off, n.off + (n.kind === 'milestone' ? 0 : n.dur)];
  let s = 1e9, e = 0;
  for (const k of n.kids) { const [a, b] = span(k); s = Math.min(s, a); e = Math.max(e, b); }
  return [s, e];
};
export const total = (nodes) => nodes.reduce((m, n) => Math.max(m, span(n)[1]), 0);
export const flat = (nodes, d = 0, out = []) => { for (const n of nodes) { out.push({ n, d }); flat(n.kids || [], d + 1, out); } return out; };
export const leaves = (nodes) => flat(nodes).filter((x) => !x.n.kids.length).map((x) => x.n);
export const find = (nodes, id, par = null) => {
  for (let i = 0; i < nodes.length; i++) {
    if (same(nodes[i].id, id)) return { n: nodes[i], arr: nodes, i, par };
    const r = find(nodes[i].kids || [], id, nodes[i]); if (r) return r;
  }
  return null;
};
export const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + Math.round(n)); return d.toISOString().slice(0, 10); };
export const weight = (n) => Math.max(n.dur || 0, 1);
export const doneWeight = (nodes) => { const ls = leaves(nodes); const t = ls.reduce((s, n) => s + weight(n), 0) || 1; return Math.round((100 * ls.filter((n) => n.done).reduce((s, n) => s + weight(n), 0)) / t); };
export function moveNode(nodes, srcId, tgtId, zone) {
  const t = clone(nodes); const s = find(t, srcId);
  if (!s || same(srcId, tgtId) || find(s.n.kids, tgtId)) return nodes;
  s.arr.splice(s.i, 1); const g = find(t, tgtId);
  if (zone === 'in') g.n.kids.push(s.n); else g.arr.splice(g.i + (zone === 'after' ? 1 : 0), 0, s.n);
  return t;
}
export const levelName = (levels, n, d) => (n.kind === 'milestone' ? 'Milestone' : n.kind === 'deliverable' ? 'Deliverable' : (levels[d] || 'Sub-component'));
export const blankNode = (parent, siblings, over = {}) => ({
  id: newId(), name: 'New item', kind: 'node', mat: [], labor: [], crew: 0, note: '', off: parent ? (parent.kids.length ? span(parent)[1] : parent.off) : total(siblings), dur: 10, res: '', done: false, dep: [], kids: [], ...over,
});
export function scaleNodes(nodes, f) { const t = clone(nodes); (function w(a) { a.forEach((n) => { n.off = Math.round(n.off * f); n.dur = Math.round(n.dur * f); w(n.kids); }); })(t); return t; }

const ICON = (n, d) => (n.kind === 'milestone' ? [Flag, '#f59e0b'] : n.kind === 'deliverable' ? [Package, '#10b981'] : [[Layers, LayoutGrid, Box, Box][Math.min(d, 3)], ['#4f46e5', '#7c3aed', '#0891b2', '#64748b'][Math.min(d, 3)]]);

// ---------- node edit modal ----------
const UNITS = ['nos', 'kW', 'kWp', 'TB', 'm', 'pairs', 'sets', 'lot'];
const num = (v) => (v === '' ? '' : +v);
function Lines({ cols, rows, onChange, blank, calc }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="pm-lines head">{cols.map((c) => <span key={c.k}>{c.label}</span>)}<span className="right">Amount</span><span /></div>
      {rows.map((r, i) => (
        <div className="pm-lines" key={i}>
          {cols.map((c) => c.unit
            ? <select key={c.k} className="input" value={r[c.k] || 'nos'} onChange={(e) => set(i, c.k, e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            : <input key={c.k} className="input" type={c.num ? 'number' : 'text'} step="any" min="0" value={r[c.k] ?? ''} onChange={(e) => set(i, c.k, c.num ? num(e.target.value) : e.target.value)} />)}
          <span className="right small b">{compact(calc(r))}</span>
          <button className="icon-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <div><button className="btn sm" onClick={() => onChange([...rows, { ...blank }])}><Plus size={13} />Add line</button></div>
    </div>
  );
}

export function NodeModal({ node, nodes, isNew, size = 1, unit = 'unit', onSave, onClose }) {
  const [f, setF] = useState(() => ({ mat: [], labor: [], crew: 0, note: '', ...clone(node) }));
  const [tab, setTab] = useState('details');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const others = flat(nodes).filter((x) => !same(x.n.id, f.id) && !flat(f.kids || []).some((k) => same(k.n.id, x.n.id)));
  const toggle = (id) => set('dep', f.dep.some((d) => same(d, id)) ? f.dep.filter((d) => !same(d, id)) : [...f.dep, id]);
  const tot = own(f, size);
  const auto = crewDays({ ...f, crew: +f.crew || 0 }, size);
  const build = () => ({ ...f, name: f.name.trim() || 'Untitled', off: Math.max(0, +f.off || 0), crew: Math.max(0, +f.crew || 0), dur: f.kind === 'milestone' ? 0 : (auto ?? Math.max(0, +f.dur || 0)), mat: f.mat.filter((m) => m.item), labor: f.labor.filter((l) => l.role) });
  return (
    <Modal size="lg" title={isNew ? 'Add item' : 'Edit item'} onClose={onClose}
      footer={<><span className="grow small muted">{tot.md ? `${tot.md.toFixed(2)} man-days · ` : ''}{compact(tot.mat + tot.lab)} direct cost at {size} {unit}</span><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(build())}>Save</button></>}>
      <div className="mb"><div className="tabs">{[['details', 'Details'], ['mat', `Materials (${f.mat.length})`], ['labor', `Manpower (${f.labor.length})`], ['note', 'Notes']].map(([id, l]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{l}</button>)}</div></div>
      {tab === 'details' && <>
        <div className="grid g2">
          <Input className="span2" label="Name" required value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          <Select label="Type" value={f.kind} onChange={(e) => set('kind', e.target.value)} options={[{ value: 'node', label: 'Structure (phase / module / component…)' }, { value: 'milestone', label: 'Milestone' }, { value: 'deliverable', label: 'Deliverable' }]} />
          <Input label="Required resource / role" value={f.res} onChange={(e) => set('res', e.target.value)} />
          <Input label="Start (day offset)" type="number" min="0" value={f.off} onChange={(e) => set('off', e.target.value)} />
          <Input label="Duration (days)" type="number" min="0" value={f.kind === 'milestone' ? 0 : (auto ?? f.dur)} disabled={f.kind === 'milestone' || f.kids?.length > 0 || auto != null} hint={f.kids?.length ? 'Parents roll up from their children' : auto != null ? `Derived: ${tot.md.toFixed(2)} man-days ÷ crew of ${f.crew}` : undefined} onChange={(e) => set('dur', e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Depends on (predecessors)</label>
          <div className="pm-deps">
            {others.map(({ n, d }) => <label key={n.id}><input type="checkbox" checked={f.dep.some((x) => same(x, n.id))} onChange={() => toggle(n.id)} /><span style={{ paddingLeft: d * 12 }}>{n.name}</span></label>)}
            {!others.length && <span className="muted small">Nothing to depend on yet.</span>}
          </div>
        </div></>}
      {tab === 'mat' && <>
        <div className="small muted mb">Quantity = fixed + (per {unit} × system size of {size} {unit}). Whole units for nos / pairs / m / sets.</div>
        <Lines rows={f.mat} onChange={(v) => set('mat', v)} blank={{ item: '', unit: 'nos', fixed: 1, perKw: 0, rate: 0 }} calc={(m) => matCost(m, size)}
          cols={[{ k: 'item', label: 'Item' }, { k: 'unit', label: 'Unit', unit: true }, { k: 'fixed', label: 'Fixed qty', num: true }, { k: 'perKw', label: `Per ${unit}`, num: true }, { k: 'rate', label: 'Rate ₹', num: true }]} /></>}
      {tab === 'labor' && <>
        <div className="small muted mb">Man-days = fixed + (per {unit} × {size}). Set a crew size to derive the task duration automatically.</div>
        <Lines rows={f.labor} onChange={(v) => set('labor', v)} blank={{ role: '', fixed: 0.5, perKw: 0, rate: 0 }} calc={(l) => labCost(l, size)}
          cols={[{ k: 'role', label: 'Role' }, { k: 'fixed', label: 'Fixed md', num: true }, { k: 'perKw', label: `md / ${unit}`, num: true }, { k: 'rate', label: '₹ / man-day', num: true }]} />
        <div className="grid g3" style={{ marginTop: 14 }}>
          <Input label="Crew size (people on site)" type="number" min="0" value={f.crew} onChange={(e) => set('crew', e.target.value)} hint="0 = use the fixed duration" />
          <div className="field"><label>Man-days</label><div className="input" style={{ background: 'var(--line-2)' }}>{tot.md.toFixed(2)}</div></div>
          <div className="field"><label>Calendar days</label><div className="input" style={{ background: 'var(--line-2)' }}>{auto ?? (f.kind === 'milestone' ? 0 : f.dur)}</div></div>
        </div></>}
      {tab === 'note' && <Textarea label="Notes / acceptance criteria / standards" rows={7} value={f.note} onChange={(e) => set('note', e.target.value)} />}
    </Modal>
  );
}

// ---------- hierarchical tree with drag & drop ----------
export default function ProjectTree({ nodes, onChange, levels = LV0, base, readOnly, showDone, locked, footerHint, size = 1, unit = 'unit' }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [modal, setModal] = useState(null);
  const [over, setOver] = useState(null);
  const drag = useRef(null);
  const ro = readOnly || locked;
  const T = Math.max(total(nodes), 1);
  const hasCost = flat(nodes).some((x) => x.n.mat?.length || x.n.labor?.length);
  const all = useMemo(() => flat(nodes), [nodes]);
  const byId = useMemo(() => Object.fromEntries(all.map((x) => [String(x.n.id), x.n])), [all]);
  const lbl = (off) => (base ? dateFmt(addDays(base, off)).replace(/ 20\d\d$/, '') : `Day ${off}`);

  const edit = (fn) => { const t = clone(nodes); fn(t); onChange(t); };
  const save = (d) => {
    const m = modal;
    edit((t) => {
      if (m.isNew) (m.parentId ? find(t, m.parentId).n.kids : t).push(d);
      else { const g = find(t, d.id); Object.assign(g.n, d, { kids: g.n.kids }); }
    });
    if (m.parentId) setCollapsed((c) => { const x = new Set(c); x.delete(String(m.parentId)); return x; });
    setModal(null);
  };
  const remove = (id) => edit((t) => { const g = find(t, id); g.arr.splice(g.i, 1); flat(t).forEach(({ n }) => { n.dep = n.dep.filter((d) => !same(d, id)); }); });
  const zoneOf = (e, el) => { const b = el.getBoundingClientRect(); const y = (e.clientY - b.top) / b.height; return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'in'; };
  const toggleAll = () => setCollapsed((c) => (c.size ? new Set() : new Set(all.filter((x) => x.n.kids.length).map((x) => String(x.n.id)))));

  const rows = (list, d) => list.map((n) => {
    const [s, e] = span(n); const open = !collapsed.has(String(n.id)); const [Ic, col] = ICON(n, d); const ms = n.kind === 'milestone';
    const preds = n.dep.map((i) => byId[String(i)]).filter(Boolean); const conflict = preds.some((p) => span(p)[1] > s);
    const isLeaf = !n.kids.length;
    const cls = over && same(over.id, n.id) ? `drop-${over.zone}` : '';
    return (
      <div key={n.id}>
        <div className={`pm-row d${Math.min(d, 1)} ${hasCost ? 'hc' : ''} ${cls}`} draggable={!ro}
          onDragStart={(ev) => { drag.current = n.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(n.id)); }}
          onDragEnd={() => { drag.current = null; setOver(null); }}
          onDragOver={(ev) => { const src = drag.current; if (src == null || same(src, n.id)) return; const sn = find(nodes, src); if (!sn || find(sn.n.kids, n.id)) return; ev.preventDefault(); let z = zoneOf(ev, ev.currentTarget); if (z === 'in' && n.kind !== 'node') z = 'after'; if (!over || !same(over.id, n.id) || over.zone !== z) setOver({ id: n.id, zone: z }); }}
          onDrop={(ev) => { ev.preventDefault(); const src = drag.current; let z = zoneOf(ev, ev.currentTarget); if (z === 'in' && n.kind !== 'node') z = 'after'; drag.current = null; setOver(null); if (src != null) onChange(moveNode(nodes, src, n.id, z)); }}>
          <div className="pm-tc" style={{ paddingLeft: d * 22 }}>
            {!ro && <span className="pm-grip"><GripVertical size={14} /></span>}
            <button className={`pm-chev ${n.kids.length ? (open ? 'open' : '') : 'none'}`} onClick={() => setCollapsed((c) => { const x = new Set(c); x.has(String(n.id)) ? x.delete(String(n.id)) : x.add(String(n.id)); return x; })}><ChevronRight size={14} /></button>
            {showDone && isLeaf && !ro ? <input type="checkbox" checked={!!n.done} title="Mark complete" onChange={() => edit((t) => { const g = find(t, n.id); g.n.done = !g.n.done; })} /> : null}
            <span className="pm-tile" style={{ background: col }}><Ic size={13} /></span>
            <span className={`pm-nm ${n.done && isLeaf ? 'done' : ''}`} title={n.name} onClick={() => !ro && setModal({ node: n })}>{n.name}</span>
            <span className="pm-lvl">{levelName(levels, n, d)}</span>
            {n.done && isLeaf && (ms || n.kind === 'deliverable') && <span className="badge good"><Check size={11} />done</span>}
          </div>
          <div className="small">
            {n.res ? <span className="pm-chip">{n.res}</span> : <span className="muted">—</span>}
            {preds.length > 0 && <span className={`pm-chip ${conflict ? 'warn' : 'link'}`} title={`${conflict ? 'Starts before predecessor ends: ' : 'Depends on: '}${preds.map((p) => p.name).join(', ')}`}><Link2 size={11} />{preds.length}</span>}
          </div>
          <div className="small muted">{ms ? lbl(s) : <>{lbl(s)} → {lbl(e)}<br /><span style={{ fontSize: 11 }}>{e - s} days</span></>}</div>
          <div className="pm-gantt"><i className={`${ms ? 'ms' : n.kind === 'deliverable' ? 'dv' : ''} ${n.done && isLeaf ? 'dn' : ''}`} style={{ left: `${(s / T) * 100}%`, width: `${Math.max(((e - s) / T) * 100, 0.8)}%` }} /></div>
          {hasCost && <div className="small right">{(() => { const c = roll(n, size); const t = c.mat + c.lab; return t ? <span title={`Materials ${compact(c.mat)} · Labour ${compact(c.lab)} · ${c.md.toFixed(1)} man-days`}>{compact(t)}{c.md > 0 && <div className="muted" style={{ fontSize: 11 }}>{c.md.toFixed(1)} md</div>}</span> : <span className="muted">—</span>; })()}</div>}
          <div className="pm-acts">{!ro && <>
            {n.kind === 'node' && <button className="icon-btn" title="Add child" onClick={() => setModal({ node: blankNode(n, nodes), isNew: true, parentId: n.id })}><Plus size={14} /></button>}
            <button className="icon-btn" title="Edit" onClick={() => setModal({ node: n })}><Pencil size={14} /></button>
            <button className="icon-btn" title="Delete" onClick={() => remove(n.id)}><Trash2 size={14} /></button></>}
          </div>
        </div>
        {n.kids.length > 0 && open && rows(n.kids, d + 1)}
      </div>
    );
  });

  return (
    <div className="card pm-tree">
      {!readOnly && (
        <div className="pm-tbar">
          <button className="btn sm primary" disabled={locked} onClick={() => setModal({ node: blankNode(null, nodes), isNew: true, parentId: null })}><Plus size={14} />Add {levels[0].toLowerCase()}</button>
          <button className="btn sm" disabled={locked} onClick={() => setModal({ node: blankNode(null, nodes, { kind: 'milestone', name: 'New milestone', dur: 0 }), isNew: true, parentId: null })}><Flag size={14} />Milestone</button>
          <button className="btn sm" onClick={toggleAll}><ChevronsUpDown size={14} />Expand / collapse</button>
          <span className="grow" /><span className="muted small">{all.length} items · {total(nodes)} days · {locked ? 'structure locked' : (footerHint || 'drag rows to re-arrange or nest')}</span>
        </div>
      )}
      <div className={`pm-th ${hasCost ? 'hc' : ''}`}><div>Structure</div><div>Resource / deps</div><div>Schedule</div><div>Timeline</div>{hasCost && <div className="right">Cost</div>}<div /></div>
      {nodes.length ? rows(nodes, 0) : <div className="empty">Empty structure — add a {levels[0].toLowerCase()} to begin.</div>}
      {modal && <NodeModal node={modal.node} nodes={nodes} size={size} unit={unit} isNew={modal.isNew} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}
