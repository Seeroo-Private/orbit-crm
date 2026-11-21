import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Printer, Pencil, Trash2, Send, CheckCircle2, XCircle, LayoutList, Columns3 } from 'lucide-react';
import { api, money, dateFmt, ymd, addDays } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, Loading, PageHead, Card, Tabs, Badge, DataTable, Input, Select, Textarea, Empty, SearchBox, Confirm, Suggest, Field, cardDrag } from '../ui/kit.jsx';
import { useLookups } from './Leads.jsx';

const STATUSES = ['Draft', 'Sent', 'Won', 'Lost', 'Expired'];
const TONE = { Draft: '', Sent: 'brand', Won: 'good', Lost: 'bad', Expired: 'warn' };

export function QuotationList() {
  const nav = useNavigate(); const { can } = useAuth(); const [status, setStatus] = useState(''); const [qv, setQv] = useState(''); const [view, setView] = useState('table');
  const d = useFetch('/quotations', { status: status === 'Expired' ? '' : status, q: qv });
  const rows = (d.data || []).filter((x) => !status || x.status === status);
  const cols = [
    { key: 'number', label: 'Quotation', render: (r) => <b>{r.number}</b> }, { key: 'customer', label: 'Customer', render: (r) => <><b>{r.customer}</b><div className="small muted">{r.phone}</div></> },
    { key: 'date', label: 'Date', render: (r) => dateFmt(r.date) }, { key: 'valid_upto', label: 'Valid till', render: (r) => dateFmt(r.valid_upto) }, { key: 'executive', label: 'Executive' },
    { key: 'total', label: 'Total', right: true, render: (r) => money(r.total) }, { key: 'status', label: 'Status', render: (r) => <Badge kind={TONE[r.status]}>{r.status}</Badge> },
  ];
  return (
    <div className="page">
      <PageHead title="Quotations" sub="Proposals from draft to won.">
        <div className="tabs"><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><LayoutList size={14} />List</button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Columns3 size={14} />Board</button></div>
        {can('lead_management', 'add') && <Link to="/quotations/new" className="btn primary" style={{ textDecoration: 'none' }}><Plus size={15} />New quotation</Link>}
      </PageHead>
      <Card flush>
        <div className="toolbar"><Tabs value={status} onChange={setStatus} tabs={[{ id: '', label: 'All' }, ...STATUSES.map((s) => ({ id: s, label: s }))]} /><div className="grow" /><SearchBox value={qv} onChange={setQv} placeholder="Number or customer" /></div>
        {!d.data ? <Loading d={d} /> : view === 'table' ? <DataTable rows={rows} columns={cols} onRow={(r) => nav(`/quotations/${r.id}`)} empty={<Empty title="No quotations" />} />
          : <div className="card-b"><QuoteBoard rows={d.data} onOpen={(id) => nav(`/quotations/${id}`)} onMoved={d.reload} /></div>}
      </Card>
    </div>
  );
}

// Expired is derived from the valid-till date, so it is shown but never a drop target.
function QuoteBoard({ rows: serverRows, onOpen, onMoved }) {
  const run = useAction(); const { can } = useAuth();
  const [rows, setRows] = useState(serverRows); const [drag, setDrag] = useState(null); const [over, setOver] = useState('');
  useEffect(() => setRows(serverRows), [serverRows]);
  const editable = can('lead_management', 'edit');
  const drop = async (id, s) => {
    const x = rows.find((r) => r.id === id);
    if (!x || x.status === s || s === 'Expired') return;
    const prev = rows;
    setRows(rows.map((r) => (r.id === id ? { ...r, status: s } : r)));
    const ok = await run(() => api.post(`/quotations/${id}/status`, { status: s }), `Marked ${s}`);
    if (ok) onMoved?.(); else setRows(prev);
  };
  return (
    <>
      {editable && <div className="small muted" style={{ marginBottom: 10 }}>Drag a card to another column to change its status. Expired is set automatically from the valid-till date.</div>}
      <div className="kanban">{STATUSES.map((s) => {
        const l = rows.filter((x) => x.status === s); const can_drop = editable && s !== 'Expired' && drag != null;
        return (
          <div className={`kcol ${over === s && can_drop ? 'over' : ''}`} key={s} data-col={s}>
            <h4><Badge kind={TONE[s]}>{s}</Badge><span className="muted">{l.length} · {money(l.reduce((a, b) => a + b.total, 0))}</span></h4>
            {l.map((x) => (
              <div className={`kcard ${drag === x.id ? 'dragging' : ''}`} key={x.id} onClick={() => onOpen(x.id)}
                onPointerDown={(e) => editable && cardDrag(e, { start: () => setDrag(x.id), over: setOver, end: (c) => { setDrag(null); setOver(''); if (c) drop(x.id, c); } })}>
                <div className="row between"><b>{x.number}</b><span className="small muted">{dateFmt(x.date)}</span></div><div className="small">{x.customer}</div><b className="num">{money(x.total)}</b>
              </div>
            ))}
            {!l.length && <div className="muted small center" style={{ padding: 14 }}>Empty</div>}
          </div>
        );
      })}</div>
    </>
  );
}

export function QuotationForm() {
  const { id } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const { user } = useAuth(); const run = useAction(); const lk = useLookups();
  const terms = useFetch('/lookups/payment-terms'); const ex = useFetch(id ? `/quotations/${id}` : null);
  const [f, setF] = useState({ customer_id: +sp.get('customer') || null, customer_name: '', lead_id: +sp.get('lead') || null, executive_id: user.id, date: ymd(), valid_upto: ymd(addDays(new Date(), 30)), subject: '', description: '', customer_note: '', terms: user.settings.quotation.terms, payment_term_id: '', discount_pct: 0, discount_amt: 0, items: [{ item_id: '', name: '', rate: '', qty: 1, note: '' }], status: 'Draft' });
  useEffect(() => { if (f.customer_id && !f.customer_name) api.get(`/customers/${f.customer_id}`).then((c) => setF((x) => ({ ...x, customer_name: c.display_name }))).catch(() => {}); }, [f.customer_id]); // eslint-disable-line
  useEffect(() => { const x = ex.data; if (x) setF({ ...x, customer_name: x.customer, items: x.items.length ? x.items : f.items, payment_term_id: x.payment_term_id || '' }); }, [ex.data]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setItem = (i, patch) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const gross = f.items.reduce((a, i) => a + (+i.rate || 0) * (+i.qty || 1), 0);
  const disc = +f.discount_pct ? gross * (+f.discount_pct / 100) : +f.discount_amt || 0;
  const total = Math.max(0, gross - disc);
  const qset = user.settings.quotation;
  const save = async (status) => {
    const body = { ...f, status: status || f.status, items: f.items.filter((i) => i.name || i.item_id) };
    const r = await run(() => (id ? api.put(`/quotations/${id}`, body).then(() => ({ id })) : api.post('/quotations', body)), 'Quotation saved');
    if (r) nav(`/quotations/${r.id}`);
  };
  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <PageHead title={id ? `Edit ${f.number || 'quotation'}` : 'New quotation'} crumbs={<Link to="/quotations">Quotations</Link>} />
      <div className="steps">
        <section className="step"><header><span className="n">1</span><h3>Customer & validity</h3></header><div className="body"><div className="grid g3">
          <Suggest label="Customer" required value={f.customer_name} onChange={(v) => setF({ ...f, customer_name: v, customer_id: null })} placeholder="Search by name or phone" fetcher={(v) => api.get('/customers/lookup', { q: v })} render={(c) => <><span>{c.display_name}</span><span className="muted small">{c.phone}</span></>} onPick={(c) => setF({ ...f, customer_id: c.id, customer_name: c.display_name })} />
          <Input label="Date" type="date" value={f.date || ''} onChange={set('date')} /><Input label="Valid until" type="date" value={f.valid_upto || ''} onChange={set('valid_upto')} />
          <Select label="Executive" value={f.executive_id} onChange={(e) => setF({ ...f, executive_id: +e.target.value })} options={lk.people.map((p) => ({ value: p.id, label: p.name }))} />
          <Input label="Subject" value={f.subject || ''} onChange={set('subject')} />
          {id && <Select label="Status" value={f.status} onChange={set('status')} options={STATUSES} />}
        </div></div></section>
        <section className="step"><header><span className="n">2</span><h3>Items</h3></header><div className="body">
          {f.items.map((it, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: '3fr 1.2fr 0.8fr 1.2fr auto', alignItems: 'end', marginBottom: 10 }}>
              <Select label={i === 0 ? 'Item' : ''} value={it.item_id || ''} onChange={(e) => { const x = lk.items.find((y) => y.id === +e.target.value); setItem(i, { item_id: +e.target.value || '', name: x?.name || '', rate: x?.price || it.rate }); }} placeholder="Pick or type below" options={lk.items.map((x) => ({ value: x.id, label: x.name }))} />
              <Input label={i === 0 ? 'Rate (₹)' : ''} type="number" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
              {qset.quantity ? <Input label={i === 0 ? 'Qty' : ''} type="number" min="1" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /> : <span />}
              <div className="right num" style={{ paddingBottom: 9 }}><b>{money((+it.rate || 0) * (+it.qty || 1))}</b></div>
              <button className="btn ghost" disabled={f.items.length === 1} onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
            </div>))}
          <button className="btn sm" onClick={() => setF({ ...f, items: [...f.items, { item_id: '', name: '', rate: '', qty: 1 }] })}><Plus size={13} />Add line</button>
          <div className="row mt" style={{ justifyContent: 'flex-end', alignItems: 'flex-start', gap: 30 }}>
            <div className="grid g2" style={{ width: 280 }}><Input label="Discount %" type="number" value={f.discount_pct} onChange={(e) => setF({ ...f, discount_pct: e.target.value, discount_amt: 0 })} /><Input label="or amount ₹" type="number" value={f.discount_amt} onChange={(e) => setF({ ...f, discount_amt: e.target.value, discount_pct: 0 })} /></div>
            <div style={{ minWidth: 210 }}><div className="row between"><span className="muted">Gross</span><span className="num">{money(gross)}</span></div><div className="row between"><span className="muted">Discount</span><span className="num">− {money(disc)}</span></div><div className="row between" style={{ fontSize: 20 }}><b>Total</b><b className="num">{money(total)}</b></div></div>
          </div>
        </div></section>
        <section className="step"><header><span className="n">3</span><h3>Terms</h3></header><div className="body col">
          {qset.payment_term && <Select label="Payment term" value={f.payment_term_id || ''} onChange={set('payment_term_id')} placeholder="None" options={(terms.data || []).map((x) => ({ value: x.id, label: x.name }))} />}
          <Textarea label="Note to customer" value={f.customer_note || ''} onChange={set('customer_note')} /><Textarea label="Terms & conditions" rows={5} value={f.terms || ''} onChange={set('terms')} />
        </div></section>
      </div>
      <div className="sticky-actions"><button className="btn" onClick={() => nav(-1)}>Cancel</button><button className="btn" onClick={() => save('Draft')}>Save draft</button><button className="btn primary" onClick={() => save('Sent')}><Send size={14} />Save & mark sent</button></div>
    </div>
  );
}

export function QuotationView() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth(); const run = useAction();
  const d = useFetch(`/quotations/${id}`); const [del, setDel] = useState(false);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const x = d.data; const co = x.company;
  const setStatus = async (s) => { await run(() => api.post(`/quotations/${x.id}/status`, { status: s }), `Marked ${s}`); d.reload(); };
  const disc = x.gross - x.total;
  return (
    <div className="page">
      <PageHead title={<span className="row">{x.number} <Badge kind={TONE[x.status]}>{x.status}</Badge></span>} crumbs={<Link to="/quotations">Quotations</Link>}>
        {x.status !== 'Won' && <button className="btn" onClick={() => setStatus('Sent')}><Send size={14} />Mark sent</button>}
        {x.status !== 'Won' && <button className="btn" style={{ color: 'var(--good)' }} onClick={() => setStatus('Won')}><CheckCircle2 size={14} />Won</button>}
        {x.status !== 'Lost' && <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => setStatus('Lost')}><XCircle size={14} />Lost</button>}
        <button className="btn" onClick={() => window.print()}><Printer size={14} />Print / PDF</button>
        {can('lead_management', 'edit') && <button className="btn" onClick={() => nav(`/quotations/${x.id}/edit`)}><Pencil size={14} /></button>}
        {can('lead_management', 'delete') && <button className="btn danger" onClick={() => setDel(true)}><Trash2 size={14} /></button>}
      </PageHead>
      <div className="q-paper">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div><h2 style={{ color: '#4f46e5', margin: 0 }}>{co.name || x.tenant?.name}</h2><div style={{ whiteSpace: 'pre-line', color: '#555' }}>{co.address}</div>{co.pan && <div style={{ color: '#555' }}>PAN {co.pan}</div>}</div>
          <div style={{ textAlign: 'right' }}><h1 style={{ margin: 0, letterSpacing: '.1em' }}>QUOTATION</h1><div><b>{x.number}</b></div><div>Date: {dateFmt(x.date)}</div><div>Valid till: {dateFmt(x.valid_upto)}</div></div>
        </div>
        <hr style={{ border: 0, borderTop: '2px solid #4f46e5', margin: '18px 0' }} />
        <div className="row between" style={{ alignItems: 'flex-start' }}><div><div style={{ color: '#777', fontSize: 11, textTransform: 'uppercase' }}>Prepared for</div><b style={{ fontSize: 16 }}>{x.customer}</b><div>{x.phone}</div><div>{x.customer_email}</div></div><div style={{ textAlign: 'right' }}><div style={{ color: '#777', fontSize: 11, textTransform: 'uppercase' }}>Executive</div><b>{x.executive}</b></div></div>
        {x.subject && <h3 style={{ margin: '18px 0 8px' }}>{x.subject}</h3>}
        <table style={{ marginTop: 14 }}><thead><tr><th>#</th><th>Item</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{x.items.map((i, n) => <tr key={i.id}><td>{n + 1}</td><td>{i.name}</td><td style={{ textAlign: 'right' }}>{money(i.rate)}</td><td style={{ textAlign: 'right' }}>{i.qty}</td><td style={{ textAlign: 'right' }}>{money(i.rate * i.qty)}</td></tr>)}</tbody></table>
        <div style={{ marginLeft: 'auto', width: 260, marginTop: 14 }}><div className="row between"><span>Gross</span><span>{money(x.gross)}</span></div>{disc > 0 && <div className="row between"><span>Discount</span><span>− {money(disc)}</span></div>}<div className="row between" style={{ fontSize: 18, borderTop: '2px solid #111', paddingTop: 6, marginTop: 6 }}><b>Total</b><b>{money(x.total)}</b></div></div>
        {x.payment_term && <p><b>Payment term:</b> {x.payment_term}</p>}{x.customer_note && <p>{x.customer_note}</p>}
        <h4 style={{ marginBottom: 4 }}>Terms & conditions</h4><div style={{ whiteSpace: 'pre-line', color: '#444' }}>{x.terms}</div>
      </div>
      {del && <Confirm danger title="Delete quotation?" message={`${x.number} will be removed.`} confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={async () => { if (await run(() => api.del(`/quotations/${x.id}`), 'Deleted')) nav('/quotations'); }} />}
    </div>
  );
}
