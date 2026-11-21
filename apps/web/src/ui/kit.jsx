import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Inbox, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Search, LogIn, LogOut } from 'lucide-react';
import { api, initials } from '../api.js';

// ---------- toasts ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, kind = '') => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">{list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}

// run an async action with toast feedback
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn, ok) => {
    try { const r = await fn(); if (ok) toast(ok, 'good'); return r; } catch (e) { toast(e.message, 'bad'); return undefined; }
  }, [toast]);
}

// ---------- data hook ----------
export function useFetch(path, params, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify([path, params, ...deps]);
  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api.get(path, params).then((d) => { setData(d); setErr(null); }).catch(setErr).finally(() => setLoading(false));
  }, [key]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { data, err, loading, reload: load, setData };
}

// ---------- layout bits ----------
export const Spinner = () => <div className="spinner" />;
export const Loading = ({ d }) => (d.err ? <div className="alert bad">{d.err.message}</div> : <Spinner />);
export const Empty = ({ title = 'Nothing here yet', sub, icon: Icon = Inbox, children }) => (
  <div className="empty"><Icon size={34} /><b>{title}</b>{sub && <div>{sub}</div>}{children}</div>
);
export function PageHead({ title, sub, crumbs, children }) {
  return (
    <div className="page-head">
      <div>{crumbs && <div className="crumbs">{crumbs}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}
export const Card = ({ title, actions, children, flush, className = '' }) => (
  <div className={`card ${className}`}>
    {(title || actions) && <div className="card-h"><h3>{title}</h3><div className="row">{actions}</div></div>}
    <div className={`card-b ${flush ? 'flush' : ''}`}>{children}</div>
  </div>
);
export const Avatar = ({ name, size }) => <span className={`avatar ${size || ''}`} title={name}>{initials(name || '?')}</span>;
export const Badge = ({ kind = '', children }) => <span className={`badge ${kind}`}>{children}</span>;
export function Stat({ label, value, sub, icon: Icon, tone = '', onClick }) {
  return (
    <div className={`card stat ${tone}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : null}>
      <div className="lbl">{label}</div><div className="val num">{value}</div>{sub && <div className="sub">{sub}</div>}
      {Icon && <span className="ico"><Icon size={18} /></span>}
    </div>
  );
}
export const Bar = ({ pct, color }) => <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} /></div>;

export const NATURE_TONE = { New: 'info', Warm: 'warn', Hot: 'accent', 'Super Hot': 'bad', Won: 'good', Lost: '' };
export const NatureBadge = ({ n }) => <Badge kind={NATURE_TONE[n] || ''}>{n}</Badge>;
export const STATUS_TONE = { pending: 'info', running: 'good', hold: 'warn', done: '' };

// ---------- forms ----------
export function Field({ label, required, hint, error, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className={required ? 'req' : ''}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  );
}
export const Input = ({ label, required, hint, error, className, ...p }) => <Field label={label} required={required} hint={hint} error={error} className={className}><input className="input" {...p} /></Field>;
export const Textarea = ({ label, required, hint, error, className, ...p }) => <Field label={label} required={required} hint={hint} error={error} className={className}><textarea className="input" {...p} /></Field>;
export function Select({ label, required, hint, error, className, options = [], placeholder, value, onChange, ...p }) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      <select className="input" value={value ?? ''} onChange={onChange} {...p}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o} value={o}>{o}</option>))}
      </select>
    </Field>
  );
}
export const Check = ({ label, hint, checked, onChange, disabled }) => (
  <label className="check"><input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{label}{hint && <span className="hint small muted" style={{ display: 'block' }}>{hint}</span>}</span></label>
);
export const Switch = ({ checked, onChange, disabled }) => <label className="switch"><input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><i /></label>;
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">{tabs.map((t) => { const o = typeof t === 'object' ? t : { id: t, label: t }; return <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>{o.label}{o.count !== undefined && <span className="badge">{o.count}</span>}</button>; })}</div>
);
export const Chips = ({ options, value, onChange }) => (
  <div className="chips">{options.map((o) => { const x = typeof o === 'object' ? o : { id: o, label: o }; return <span key={x.id} className={`chip ${value === x.id ? 'active' : ''}`} onClick={() => onChange(value === x.id ? '' : x.id)}>{x.label}</span>; })}</div>
);
export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { const t = setTimeout(() => onChange(v), 300); return () => clearTimeout(t); }, [v]); // eslint-disable-line
  return <div className="row" style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 11, color: 'var(--muted)' }} /><input className="input" style={{ paddingLeft: 34, width: 240 }} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} /></div>;
}

// ---------- overlays ----------
export function Modal({ title, onClose, children, footer, size = '' }) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ title, onClose, children, footer }) {
  return (
    <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="modal-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-b" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
export function Confirm({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></>}>
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

// Check in / check out confirmation: live clock, and worked-so-far timer when checking out.
export function AttendanceConfirm({ checkedIn, since, name, onConfirm, onClose }) {
  const [now, setNow] = useState(() => new Date()); const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  const first = (name || '').split(' ')[0];
  const ms = checkedIn && since ? Math.max(0, now - new Date(since)) : 0;
  const worked = `${Math.floor(ms / 3600000)}h ${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}m`;
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { onClose(); } };
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`att-card ${checkedIn ? 'out' : 'in'}`} role="dialog" aria-label={checkedIn ? 'Check out' : 'Check in'}>
        <button className="icon-btn att-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="att-hero">
          <div className="att-ring">{checkedIn ? <LogOut size={26} /> : <LogIn size={26} />}</div>
          <div className="att-hello">{checkedIn ? `Wrapping up${first ? `, ${first}` : ''}?` : `Good ${now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}${first ? `, ${first}` : ''}`}</div>
          <div className="att-time num">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div className="att-date">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        {checkedIn && <div className="att-stats">
          <div><span>Checked in</span><b className="num">{since ? new Date(since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</b></div>
          <div><span>Worked today</span><b className="num">{worked}</b></div>
        </div>}
        <div className="att-actions">
          <button className="btn att-go" disabled={busy} autoFocus onClick={go}>{checkedIn ? <><LogOut size={16} />Confirm check out</> : <><LogIn size={16} />Confirm check in</>}</button>
          <button className="btn ghost" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>, document.body
  );
}

// ---------- table ----------
export function DataTable({ columns, rows, onRow, selectable, selected = [], onSelect, empty, sortable = true, dense }) {
  const [sort, setSort] = useState(null);
  const data = useMemo(() => {
    if (!sort) return rows || [];
    return [...(rows || [])].sort((a, b) => { const x = a[sort.key], y = b[sort.key]; const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true }); return sort.dir === 'asc' ? r : -r; });
  }, [rows, sort]);
  if (!rows?.length) return empty || <Empty />;
  const all = selectable && data.length && data.every((r) => selected.includes(r.id));
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr>
          {selectable && <th style={{ width: 36 }}><input type="checkbox" checked={!!all} onChange={(e) => onSelect(e.target.checked ? data.map((r) => r.id) : [])} /></th>}
          {columns.map((c) => (
            <th key={c.key} className={`${c.right ? 'right' : ''} ${sortable && !c.nosort ? 'sortable' : ''}`} onClick={() => sortable && !c.nosort && setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }))}>
              {c.label}{sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </th>
          ))}
        </tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id ?? i} className={onRow ? 'click' : ''} onClick={() => onRow?.(r)}>
              {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => onSelect(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} /></td>}
              {columns.map((c) => <td key={c.key} className={`${c.right ? 'right num' : ''}`} style={dense ? { padding: '7px 12px' } : null}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="pager"><span>{total} record{total === 1 ? '' : 's'}</span>
      <div className="row"><button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /></button><span>Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={14} /></button></div>
    </div>
  );
}

// suggest-as-you-type (customers, etc.)
export function Suggest({ value, onChange, fetcher, render, onPick, placeholder, label, required }) {
  const [list, setList] = useState([]); const [open, setOpen] = useState(false); const t = useRef();
  return (
    <Field label={label} required={required}>
      <div style={{ position: 'relative' }}>
        <input className="input" value={value} placeholder={placeholder} onChange={(e) => { onChange(e.target.value); clearTimeout(t.current); const v = e.target.value; t.current = setTimeout(async () => { if (v.length < 2) return setList([]); setList(await fetcher(v)); setOpen(true); }, 250); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && list.length > 0 && <div className="suggest">{list.map((x) => <div key={x.id} onMouseDown={() => { onPick(x); setOpen(false); }}>{render(x)}</div>)}</div>}
      </div>
    </Field>
  );
}

// Pointer-based card drag. The browser's native drag ghost is always see-through, so we float our own solid copy.
// cb: { start(), over(col|''), end(col|null) }; drop targets are elements with data-col.
export function cardDrag(e, cb) {
  if (e.button !== 0) return;
  const el = e.currentTarget, box = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  let ghost = null, col = '';
  const colAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-col]')?.dataset.col || '';
  const move = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      ghost = el.cloneNode(true); ghost.classList.add('kghost'); ghost.style.width = `${box.width}px`;
      document.body.appendChild(ghost); document.body.classList.add('kdragging'); cb.start();
    }
    ghost.style.left = `${ev.clientX - (sx - box.left)}px`; ghost.style.top = `${ev.clientY - (sy - box.top)}px`;
    const c = colAt(ev.clientX, ev.clientY); if (c !== col) { col = c; cb.over(c); }
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!ghost) return;
    ghost.remove(); document.body.classList.remove('kdragging');
    window.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true }); // a drop must not open the card
    cb.end(ev.type === 'pointercancel' ? null : colAt(ev.clientX, ev.clientY) || null);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
