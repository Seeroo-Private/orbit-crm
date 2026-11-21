import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Plus, LayoutList, Columns3, Phone, MapPin, ArrowRightLeft, ThumbsDown, ListPlus, Copy, MessageSquarePlus, Wallet, FileText, Trash2, Pencil, Sparkles, AlertTriangle, Mail, Flame } from 'lucide-react';
import { api, money, dateTime, dateFmt, localInput, addDays, ymd, compact } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, useToast, Loading, PageHead, Card, Tabs, Chips, Badge, NatureBadge, DataTable, Pager, Modal, Input, Select, Textarea, Check, Field, Empty, SearchBox, Avatar, Suggest, Confirm, cardDrag } from '../ui/kit.jsx';

const QUALITIES = ['Not Connected', 'Not Reachable', 'Cold', 'Warm', 'Hot', 'Super Hot'];
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Nurture'];
const PERIODS = [{ id: '', label: 'All time' }, { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'year', label: 'This year' }];

export const useLookups = () => {
  const people = useFetch('/people'), sources = useFetch('/lead-sources'), statuses = useFetch('/lead-statuses'), items = useFetch('/items'), branches = useFetch('/branches');
  return { people: people.data || [], sources: sources.data || [], statuses: statuses.data || [], items: items.data || [], branches: branches.data || [] };
};
const opt = (a, l = 'name') => a.map((x) => ({ value: x.id, label: x[l] }));
const dueBadge = (l) => {
  if (!l.next_followup || ['Won', 'Lost'].includes(l.nature)) return <span className="muted">—</span>;
  const late = l.next_followup.slice(0, 10) < ymd();
  return <Badge kind={late ? 'bad' : l.next_followup.slice(0, 10) === ymd() ? 'warn' : 'brand'}>{dateTime(l.next_followup)}</Badge>;
};

// ============================ Lead list ============================
export function LeadList() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const lk = useLookups(); const { can } = useAuth(); const run = useAction();
  const [view, setView] = useState('table');
  const [f, setF] = useState({ tab: sp.get('tab') || '', q: '', status: '', source: '', assignee: '', quality: '', period: '', missed: sp.get('missed') || '', page: 1 });
  const [sel, setSel] = useState([]); const [dlg, setDlg] = useState(null);
  const params = { ...f, limit: view === 'board' ? 300 : 25 };
  const d = useFetch('/leads', params);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v, page: k === 'page' ? v : 1 })); setSel([]); };
  const c = d.data?.counts || {};
  const tabs = [{ id: '', label: 'All', count: c.all }, { id: 'new', label: 'New', count: c.new }, { id: 'followup', label: 'In follow-up', count: c.followup }, { id: 'won', label: 'Won', count: c.won }, { id: 'lost', label: 'Lost', count: c.lost }];
  const cols = [
    { key: 'number', label: '#', render: (r) => <b>#{r.number}</b> },
    { key: 'customer', label: 'Customer', render: (r) => <div className="row"><Avatar name={r.customer} size="sm" /><div><b>{r.customer}</b><div className="small muted">{r.phone}</div></div></div> },
    { key: 'items', label: 'Enquiry for', render: (r) => <span className="small">{r.items || '—'}</span> },
    { key: 'nature', label: 'Nature', render: (r) => <NatureBadge n={r.nature} /> },
    { key: 'status', label: 'Status', render: (r) => r.status || <span className="muted">New</span> },
    { key: 'source', label: 'Source' }, { key: 'assignee', label: 'Executive' },
    { key: 'business_value', label: 'Value', right: true, render: (r) => money(r.business_value) },
    { key: 'next_followup', label: 'Next follow-up', render: dueBadge },
  ];
  return (
    <div className="page">
      <PageHead title="Leads" sub="Every enquiry, by nature and status.">
        <div className="tabs"><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><LayoutList size={14} />List</button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Columns3 size={14} />Board</button></div>
        {can('lead_management', 'add') && <Link to="/leads/new" className="btn primary" style={{ textDecoration: 'none' }}><Plus size={15} />New enquiry</Link>}
      </PageHead>
      <div className="card">
        <div className="toolbar"><Tabs tabs={tabs} value={f.tab} onChange={(v) => set('tab', v)} /><div className="grow" />
          <SearchBox value={f.q} onChange={(v) => set('q', v)} placeholder="Name, phone or #…" /></div>
        <div className="toolbar">
          <select className="input" style={{ width: 150 }} value={f.period} onChange={(e) => set('period', e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          <select className="input" style={{ width: 160 }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">All statuses</option>{lk.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="input" style={{ width: 150 }} value={f.source} onChange={(e) => set('source', e.target.value)}><option value="">All sources</option>{lk.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="input" style={{ width: 150 }} value={f.assignee} onChange={(e) => set('assignee', e.target.value)}><option value="">All executives</option>{lk.people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="input" style={{ width: 140 }} value={f.quality} onChange={(e) => set('quality', e.target.value)}><option value="">Any quality</option>{QUALITIES.map((s) => <option key={s}>{s}</option>)}</select>
          <Check label="Missed follow-ups" checked={!!f.missed} onChange={(v) => set('missed', v ? '1' : '')} />
        </div>
        {sel.length > 0 && (
          <div className="bulkbar"><span>{sel.length} selected</span><div className="grow" />
            {can('lead_transfer', 'add') && <button className="btn sm" onClick={() => setDlg('transfer')}><ArrowRightLeft size={13} />Transfer</button>}
            <button className="btn sm" onClick={() => setDlg('task')}><ListPlus size={13} />Assign task</button>
            <button className="btn sm" onClick={() => setDlg('copy')}><Copy size={13} />Create from existing</button>
            <button className="btn sm danger" onClick={() => setDlg('lost')}><ThumbsDown size={13} />Mark lost</button>
            <button className="btn sm ghost" onClick={() => setSel([])}>Clear</button></div>
        )}
        {!d.data ? <Loading d={d} /> : view === 'table' ? (
          <>
            <DataTable rows={d.data.rows} columns={cols} selectable selected={sel} onSelect={setSel} onRow={(r) => nav(`/leads/${r.id}`)} sortable={false}
              empty={<Empty title="No leads match" sub="Try clearing a filter, or add a new enquiry." />} />
            <Pager page={d.data.page} pages={Math.ceil(d.data.total / d.data.limit) || 1} total={d.data.total} onPage={(p) => set('page', p)} />
          </>
        ) : <div className="card-b"><Board rows={d.data.rows} onOpen={(id) => nav(`/leads/${id}`)} onMoved={d.reload} /></div>}
      </div>
      {dlg && <BulkDialog kind={dlg} ids={sel} lk={lk} onClose={() => setDlg(null)} onDone={() => { setDlg(null); setSel([]); d.reload(); }} />}
    </div>
  );
}

function Board({ rows: serverRows, onOpen, onMoved }) {
  const run = useAction(); const { can } = useAuth();
  const [group, setGroup] = useState('stage');
  const [rows, setRows] = useState(serverRows); const [drag, setDrag] = useState(null); const [over, setOver] = useState('');
  useEffect(() => setRows(serverRows), [serverRows]);
  const editable = can('lead_management', 'edit');
  const byStage = group === 'stage';
  const cols = byStage ? [...STAGES, 'Won', 'Lost'] : ['New', 'Warm', 'Hot', 'Super Hot', 'Won', 'Lost'];
  const dropOk = (n) => byStage ? STAGES.includes(n) : ['Warm', 'Hot', 'Super Hot'].includes(n);
  const colOf = (r) => byStage ? (['Won', 'Lost'].includes(r.nature) ? r.nature : r.stage) : r.nature;
  const drop = async (id, n) => {
    const lead = rows.find((r) => r.id === id);
    if (!lead || colOf(lead) === n || !dropOk(n)) return;
    const patch = byStage ? { stage: n } : { quality: n, nature: n, stage: lead.stage === 'New' ? 'Contacted' : lead.stage };
    const prev = rows;
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const ok = await run(() => api.post(`/leads/${id}/move`, byStage ? { stage: n } : { quality: n }), `Moved to ${n}`);
    if (ok) onMoved?.(); else setRows(prev);
  };
  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="tabs"><button className={byStage ? 'active' : ''} onClick={() => setGroup('stage')}>By stage</button><button className={!byStage ? 'active' : ''} onClick={() => setGroup('nature')}>By temperature</button></div>
        <span className="small muted">{editable ? 'Drag a card to another column to move it. Won / Lost are set from a follow-up.' : ''}</span>
      </div>
      <div className="kanban">
        {cols.map((n) => {
          const list = rows.filter((r) => colOf(r) === n);
          const can_drop = editable && dropOk(n) && drag != null;
          return (
            <div className={`kcol ${over === n && can_drop ? 'over' : ''}`} key={n} data-col={n}>
              <h4><span className="row">{byStage && STAGES.includes(n) ? <b>{n}</b> : <NatureBadge n={n} />}</span><span className="muted">{list.length} · {compact(list.reduce((a, b) => a + (b.business_value || 0), 0))}</span></h4>
              {list.map((l) => {
                const closed = ['Won', 'Lost'].includes(l.nature);
                return (
                  <div key={l.id} className={`kcard ${drag === l.id ? 'dragging' : ''}`} style={{ cursor: editable && !closed ? 'grab' : 'pointer' }} onClick={() => onOpen(l.id)}
                    onPointerDown={(e) => editable && !closed && cardDrag(e, { start: () => setDrag(l.id), over: setOver, end: (c) => { setDrag(null); setOver(''); if (c) drop(l.id, c); } })}>
                    <div className="row between"><b>{l.customer}</b><span className="small muted">#{l.number}</span></div>
                    <div className="small muted truncate">{l.items || 'No item'}</div>
                    <div className="row between" style={{ marginTop: 8 }}><b className="num small">{money(l.business_value)}</b><span className="small">{l.assignee?.split(' ')[0]}</span></div>
                    <div className="row between" style={{ marginTop: 6 }}>{byStage ? <NatureBadge n={l.nature} /> : <span className="small muted">{l.stage}</span>}{!closed && l.next_followup && dueBadge(l)}</div>
                  </div>
                );
              })}
              {!list.length && <div className="muted small center" style={{ padding: 14 }}>Empty</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function BulkDialog({ kind, ids, lk, onClose, onDone }) {
  const run = useAction();
  const [b, setB] = useState({ to_user: '', reason: '', status_id: '', type: 'Call', title: '', scheduled_at: localInput(addDays(new Date(), 1)), host_id: '', assignees: [] });
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  const lost = lk.statuses.filter((s) => s.nature === 'lost');
  const titles = { transfer: 'Transfer leads', lost: 'Mark as lost', task: 'Assign a task', copy: 'Create enquiries from existing' };
  const submit = async () => {
    const body = { ids, action: kind === 'copy' ? 'create_from_existing' : kind === 'task' ? 'assign_task' : kind, ...b };
    if (kind === 'transfer' && !b.to_user) throw new Error('Pick who receives the leads');
    const r = await api.post('/leads/bulk', body); return r;
  };
  return (
    <Modal title={`${titles[kind]} (${ids.length})`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={`btn ${kind === 'lost' ? 'danger' : 'primary'}`} onClick={async () => { const r = await run(submit, 'Done'); if (r) onDone(); }}>Apply</button></>}>
      <div className="col">
        {kind === 'transfer' && <Select label="Transfer to" required value={b.to_user} onChange={set('to_user')} placeholder="Choose executive" options={opt(lk.people)} />}
        {kind === 'lost' && <><Select label="Lost reason" value={b.status_id} onChange={set('status_id')} placeholder="Default reason" options={opt(lost)} /><Textarea label="Note" value={b.reason} onChange={set('reason')} /></>}
        {kind === 'task' && <>
          <Select label="Task type" value={b.type} onChange={set('type')} options={['Call', 'Online Meeting', 'Offline Meeting', 'Activities']} />
          <Input label="Title" value={b.title} onChange={set('title')} placeholder="e.g. Follow up on quotation" />
          <Input label="When" type="datetime-local" value={b.scheduled_at} onChange={set('scheduled_at')} />
          <Select label="Host" value={b.host_id} onChange={set('host_id')} placeholder="Lead’s executive" options={opt(lk.people)} /></>}
        {kind === 'copy' && <Field label="Assign to (round-robin)"><div className="chips">{lk.people.map((p) => <span key={p.id} className={`chip ${b.assignees.includes(p.id) ? 'active' : ''}`} onClick={() => setB({ ...b, assignees: b.assignees.includes(p.id) ? b.assignees.filter((x) => x !== p.id) : [...b.assignees, p.id] })}>{p.name}</span>)}</div></Field>}
      </div>
    </Modal>
  );
}

// ============================ Lead form ============================
export function LeadForm() {
  const nav = useNavigate(); const { id } = useParams(); const { user } = useAuth(); const run = useAction(); const lk = useLookups();
  const s = user.settings.enquiry;
  const [f, setF] = useState({ customer_id: null, phone: '', name: '', place: '', items: [{ item_id: '', quantity: 1, note: '' }], assignee_id: s.assign_auto ? '' : user.id, source_id: '', business_value: '', quality: '', remark: '', next_followup: localInput(addDays(new Date(), 1)).slice(0, 11) + '10:00', followup_required: true, branch_id: user.branch_id || '', dealer: '' });
  const [found, setFound] = useState(null); const [errs, setErrs] = useState({});
  const existing = useFetch(id ? `/leads/${id}` : null);
  useEffect(() => { const l = existing.data; if (l) setF({ customer_id: l.customer_id, phone: l.customer?.phone || '', name: l.customer?.display_name || '', place: l.place || '', items: l.line_items.length ? l.line_items : [{ item_id: '', quantity: 1 }], assignee_id: l.assignee_id, source_id: l.source_id || '', business_value: l.business_value, quality: l.quality || '', remark: l.remark || '', next_followup: l.next_followup || '', followup_required: !!l.followup_required, branch_id: l.branch_id, dealer: l.dealer || '' }); }, [existing.data]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, [k]: v, ...(k === 'item_id' ? { item_name: lk.items.find((y) => y.id === +v)?.name } : {}) } : x)) });
  const lookupPhone = async (v) => { setF((x) => ({ ...x, phone: v, customer_id: null })); const digits = v.replace(/\D/g, ''); if (digits.length >= 6) { const r = await api.get('/customers/lookup', { q: digits }); setFound(r.find((x) => x.phone === digits) || null); } else setFound(null); };
  const pickCustomer = (c) => { setF({ ...f, customer_id: c.id, name: c.display_name, phone: c.phone, place: c.place || f.place }); setFound(null); };
  const dealers = useFetch('/lookups/dealers');

  const validate = () => {
    const e = {};
    const digits = f.phone.replace(/\D/g, '');
    if (!f.customer_id && !f.name) e.name = 'Customer name is required';
    if (!f.customer_id && (digits.length < 6 || digits.length > 15)) e.phone = 'Enter a phone number of 6–15 digits';
    if (!f.assignee_id && !s.assign_auto) e.assignee_id = 'Choose who this is assigned to';
    if (s.need_source && s.require_source && !f.source_id) e.source_id = 'Lead source is required';
    if (s.need_remark && s.require_remark && !f.remark) e.remark = 'Remark is required';
    if (s.need_place && s.require_place && !f.place) e.place = 'Place is required';
    if (s.need_business_value && s.require_business_value && !f.business_value) e.business_value = 'Business value is required';
    if (s.need_lead_quality && s.require_lead_quality && !f.quality) e.quality = 'Lead quality is required';
    if (s.need_quantity && s.require_quantity && !f.items.some((i) => +i.quantity > 0 && i.item_id)) e.items = 'Add at least one item with quantity';
    if (f.followup_required && !f.next_followup) e.next_followup = 'Set the next follow-up';
    setErrs(e); return !Object.keys(e).length;
  };
  const save = async () => {
    if (!validate()) return;
    const body = { ...f, items: f.items.filter((i) => i.item_id || i.item_name), new_customer: f.customer_id ? undefined : { name: f.name, phone: f.phone.replace(/\D/g, ''), place: f.place } };
    const r = await run(() => (id ? api.put(`/leads/${id}`, body) : api.post('/leads', body)), id ? 'Enquiry updated' : 'Enquiry created');
    if (r) nav(`/leads/${r.id || id}`);
  };
  const Step = ({ n, title, children }) => <section className="step"><header><span className="n">{n}</span><h3>{title}</h3></header><div className="body">{children}</div></section>;
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHead title={id ? `Edit enquiry #${existing.data?.number || ''}` : 'New enquiry'} crumbs={<Link to="/leads">Leads</Link>} sub="Fill it in section by section — required fields follow your Enquiry Settings." />
      <div className="steps">
        <Step n="1" title="Customer">
          <div className="grid g3">
            <div style={{ position: 'relative' }}>
              <Input label="Phone" required value={f.phone} onChange={(e) => lookupPhone(e.target.value)} error={errs.phone} placeholder="10-digit mobile" disabled={!!f.customer_id && !!id} />
              {found && <div className="suggest" style={{ padding: 8 }}><div onMouseDown={() => pickCustomer(found)}><span><b>{found.display_name}</b> already exists</span><Badge kind="brand">Use</Badge></div></div>}
            </div>
            <Suggest label="Customer name" required value={f.name} onChange={(v) => setF({ ...f, name: v, customer_id: null })} placeholder="Type to search or add new" fetcher={(v) => api.get('/customers', { q: v, field: 'name' }).then((r) => r.rows.slice(0, 6))} render={(c) => <><span>{c.display_name}</span><span className="muted small">{c.phone}</span></>} onPick={pickCustomer} />
            {s.need_place && <Input label="Place" required={s.require_place} value={f.place} onChange={set('place')} error={errs.place} />}
          </div>
          {errs.name && <div className="err small" style={{ color: 'var(--bad)', marginTop: 6 }}>{errs.name}</div>}
          {f.customer_id && <div className="alert good mt small">Linked to an existing customer profile.</div>}
        </Step>
        <Step n="2" title="What they enquired about">
          {f.items.map((it, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: '3fr 1fr 2fr auto', alignItems: 'end', marginBottom: 10 }}>
              <Select label={i === 0 ? 'Item' : ''} value={it.item_id || ''} onChange={(e) => setItem(i, 'item_id', +e.target.value)} placeholder="Choose an item" options={lk.items.map((x) => ({ value: x.id, label: `${x.name} — ${money(x.price)}` }))} />
              {s.need_quantity && <Input label={i === 0 ? 'Qty' : ''} type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />}
              {s.need_item_description && <Input label={i === 0 ? 'Description' : ''} value={it.note || ''} onChange={(e) => setItem(i, 'note', e.target.value)} />}
              <button className="btn ghost" disabled={f.items.length === 1} onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn sm" onClick={() => setF({ ...f, items: [...f.items, { item_id: '', quantity: 1 }] })}><Plus size={13} />Add another item</button>
          {errs.items && <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>{errs.items}</div>}
        </Step>
        <Step n="3" title="Assignment & source">
          <div className="grid g3">
            <Select label="Assign to" required={!s.assign_auto} value={f.assignee_id} onChange={(e) => setF({ ...f, assignee_id: +e.target.value || '' })} placeholder={s.assign_auto ? 'Auto-assign (round-robin)' : 'Choose'} options={opt(lk.people)} error={errs.assignee_id} />
            <Select label="Branch" value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: +e.target.value })} options={opt(lk.branches)} />
            {s.need_source && <Select label="Lead source" required={s.require_source} value={f.source_id} onChange={(e) => setF({ ...f, source_id: +e.target.value || '' })} placeholder="Choose" options={opt(lk.sources)} error={errs.source_id} />}
            {s.need_dealer && <Select label="Dealer" value={f.dealer} onChange={set('dealer')} placeholder="None" options={(dealers.data || []).map((x) => x.name)} />}
          </div>
        </Step>
        <Step n="4" title="Value & next step">
          <div className="grid g3">
            {s.need_business_value && <Input label="Business value (₹)" required={s.require_business_value} type="number" value={f.business_value} onChange={set('business_value')} error={errs.business_value} />}
            {s.need_lead_quality && <Select label="Lead quality" required={s.require_lead_quality} value={f.quality} onChange={set('quality')} placeholder="Not rated" options={QUALITIES} error={errs.quality} />}
            <div className="col gap-sm"><Check label="Follow-up required" checked={f.followup_required} onChange={(v) => setF({ ...f, followup_required: v })} />{f.followup_required && <Input type="datetime-local" value={f.next_followup} onChange={set('next_followup')} error={errs.next_followup} />}</div>
          </div>
          {s.need_remark && <div className="mt"><Textarea label="Remark" required={s.require_remark} value={f.remark} onChange={set('remark')} error={errs.remark} /></div>}
        </Step>
      </div>
      <div className="sticky-actions"><button className="btn" onClick={() => nav(-1)}>Cancel</button><button className="btn primary" onClick={save}>{id ? 'Save changes' : 'Create enquiry'}</button></div>
    </div>
  );
}

// ============================ Follow-up dialog ============================
export function FollowupDialog({ lead, onClose, onDone, lk }) {
  const run = useAction(); const { user } = useAuth(); const s = user.settings.enquiry;
  const [f, setF] = useState({ status_id: '', quality: lead.quality || '', stage: lead.stage, description: '', next_followup: localInput(addDays(new Date(), 2)).slice(0, 11) + '10:00', business_value: lead.business_value || '' });
  const st = lk.statuses.find((x) => x.id === +f.status_id);
  const ended = st && st.nature !== 'followup';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.status_id) throw new Error('Choose a status');
    if (s.require_followup_remark && !f.description) throw new Error('Add a remark');
    return api.post(`/leads/${lead.id}/followup`, { ...f, followup_required: !ended });
  };
  return (
    <Modal title={`Follow-up · #${lead.number}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(save, 'Follow-up saved')) onDone(); }}>Save follow-up</button></>}>
      <div className="col">
        <Select label="Status" required value={f.status_id} onChange={set('status_id')} placeholder="What happened?" options={lk.statuses.map((x) => ({ value: x.id, label: `${x.name}${x.nature !== 'followup' ? ` (${x.nature})` : ''}` }))} />
        <div className="grid g2"><Select label="Quality" value={f.quality} onChange={set('quality')} placeholder="Unchanged" options={QUALITIES} />{s.lead_stage && <Select label="Stage" value={f.stage} onChange={set('stage')} options={STAGES} />}</div>
        <Input label="Business value (₹)" type="number" value={f.business_value} onChange={set('business_value')} />
        <Textarea label="Remark" required={s.require_followup_remark} value={f.description} onChange={set('description')} />
        {!ended && <Input label="Next follow-up" type="datetime-local" value={f.next_followup} onChange={set('next_followup')} />}
        {ended && <div className="alert">This will close the lead as <b>{st.nature}</b>.</div>}
      </div>
    </Modal>
  );
}

// ============================ Lead detail ============================
export function LeadDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth(); const run = useAction(); const lk = useLookups();
  const d = useFetch(`/leads/${id}`); const [tab, setTab] = useState('timeline'); const [dlg, setDlg] = useState(null); const [amt, setAmt] = useState('');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const l = d.data, c = l.customer;
  const open = !['Won', 'Lost'].includes(l.nature);
  return (
    <div className="page">
      <PageHead title={<span className="row">Enquiry #{l.number} <NatureBadge n={l.nature} />{l.sla_breached ? <Badge kind="bad"><AlertTriangle size={11} />SLA breached</Badge> : null}</span>} crumbs={<><Link to="/leads">Leads</Link> / #{l.number}</>}>
        {open && can('lead_management', 'edit') && <button className="btn primary" onClick={() => setDlg('followup')}><MessageSquarePlus size={15} />Add follow-up</button>}
        {can('lead_management', 'add') && <button className="btn" onClick={() => nav(`/quotations/new?lead=${l.id}&customer=${l.customer_id}`)}><FileText size={15} />Quotation</button>}
        {can('lead_transfer', 'add') && <button className="btn" onClick={() => setDlg('transfer')}><ArrowRightLeft size={15} />Transfer</button>}
        {can('lead_management', 'edit') && <button className="btn" onClick={() => nav(`/leads/${l.id}/edit`)}><Pencil size={15} /></button>}
        {can('lead_management', 'delete') && <button className="btn danger" onClick={() => setDlg('delete')}><Trash2 size={15} /></button>}
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', alignItems: 'start' }}>
        <div className="col">
          <Card title="Customer" actions={<Link to={`/customers/${c.id}`} className="small">Profile</Link>}>
            <div className="row"><Avatar name={c.display_name} size="lg" /><div><b style={{ fontSize: 16 }}>{c.display_name}</b><div className="small muted">{c.type} · {c.level}</div></div></div>
            <dl className="kv mt"><dt>Phone</dt><dd><Phone size={12} /> {c.country_code} {c.phone}</dd><dt>Email</dt><dd>{c.email || '—'}</dd><dt>Place</dt><dd><MapPin size={12} /> {l.place || c.place || '—'}</dd></dl>
          </Card>
          <Card title="Deal">
            <dl className="kv"><dt>Value</dt><dd><b>{money(l.business_value)}</b></dd><dt>Stage</dt><dd>{l.stage}</dd><dt>Quality</dt><dd>{l.quality || '—'}</dd><dt>Status</dt><dd>{l.status || 'New'}</dd><dt>Source</dt><dd>{l.source || '—'}</dd><dt>Executive</dt><dd>{l.assignee}</dd><dt>Branch</dt><dd>{l.branch || '—'}</dd><dt>Next follow-up</dt><dd>{dueBadge(l)}</dd><dt>Created</dt><dd>{dateTime(l.created_at)}</dd>{l.lost_reason && <><dt>Lost reason</dt><dd>{l.lost_reason}</dd></>}</dl>
            {l.remark && <div className="alert mt small">{l.remark}</div>}
          </Card>
          <Card title="Enquired for">{l.line_items.map((i) => <div className="list-item" key={i.id}><div className="grow">{i.item_name}{i.note && <div className="small muted">{i.note}</div>}</div><Badge>×{i.quantity}</Badge></div>)}{!l.line_items.length && <div className="muted">No items</div>}</Card>
          {l.nature === 'Won' && (
            <Card title="Collection">
              <div className="row between"><span className="muted">Collected</span><b>{money(l.collected)} / {money(l.business_value)}</b></div>
              <div className="bar mt"><i style={{ width: `${Math.min(100, (l.collected / (l.business_value || 1)) * 100)}%`, background: 'var(--good)' }} /></div>
              {l.collected < l.business_value && <div className="row mt"><input className="input" type="number" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} /><button className="btn primary" onClick={async () => { if (await run(() => api.post(`/leads/${l.id}/collect`, { amount: +amt }), 'Payment recorded')) { setAmt(''); d.reload(); } }}><Wallet size={14} />Record</button></div>}
            </Card>)}
        </div>
        <Card flush>
          <div className="toolbar"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'timeline', label: 'Follow-ups', count: l.followups.length }, { id: 'quotes', label: 'Quotations', count: l.quotations.length }, { id: 'tasks', label: 'Tasks', count: l.tasks.length }, { id: 'transfers', label: 'Transfers', count: l.transfers.length }, { id: 'calls', label: 'Calls', count: l.calls.length }, { id: 'auto', label: 'Automations', count: l.automations.length }]} /></div>
          <div className="card-b">
            {tab === 'timeline' && (l.followups.length ? <div className="timeline">{l.followups.map((f) => <div className="tl" key={f.id}><div className="row between"><b>{f.status || 'Update'}</b><span className="small muted">{dateTime(f.created_at)} · {f.user}</span></div><div className="small">{f.description || '—'}</div><div className="row wrap gap-sm mt" style={{ marginTop: 4 }}>{f.quality && <Badge>{f.quality}</Badge>}{f.stage && <Badge kind="brand">{f.stage}</Badge>}{f.next_followup && <Badge kind="info">Next {dateTime(f.next_followup)}</Badge>}</div></div>)}</div> : <Empty title="No follow-ups yet" sub="Log the first conversation to start the timeline." />)}
            {tab === 'quotes' && (l.quotations.length ? l.quotations.map((x) => <div className="list-item" key={x.id}><FileText size={16} /><Link to={`/quotations/${x.id}`} className="grow"><b>{x.number}</b> <span className="muted small">{dateFmt(x.date)}</span></Link><b>{money(x.total)}</b><Badge kind={x.status === 'Won' ? 'good' : x.status === 'Lost' ? 'bad' : 'brand'}>{x.status}</Badge></div>) : <Empty title="No quotations" />)}
            {tab === 'tasks' && (l.tasks.length ? l.tasks.map((x) => <div className="list-item" key={x.id}><Badge kind="info">{x.type}</Badge><div className="grow">{x.title}<div className="small muted">{x.host} · {dateTime(x.scheduled_at)}</div></div><Badge>{x.status}</Badge></div>) : <Empty title="No tasks linked" />)}
            {tab === 'transfers' && (l.transfers.length ? l.transfers.map((x) => <div className="list-item" key={x.id}><ArrowRightLeft size={15} /><div className="grow">{x.from_name} → <b>{x.to_name}</b></div><Badge>{x.status}</Badge><span className="small muted">{dateTime(x.created_at)}</span></div>) : <Empty title="Never transferred" />)}
            {tab === 'calls' && (l.calls.length ? l.calls.map((x) => <div className="list-item" key={x.id}><Badge kind={x.sentiment === 'Positive' ? 'good' : x.sentiment === 'Negative' ? 'bad' : 'warn'}>{x.sentiment}</Badge><div className="grow small">{x.summary}</div><b>{x.score}</b></div>) : <Empty title="No analysed calls" sub="Paste a transcript under Call Analysis." />)}
            {tab === 'auto' && (l.automations.length ? l.automations.map((x) => <div className="list-item" key={x.id}><Mail size={15} /><div className="grow">{x.trigger_on} · {x.medium}</div><Badge kind={x.status === 'Sent' ? 'good' : 'bad'}>{x.status}</Badge><span className="small muted">{dateTime(x.created_at)}</span></div>) : <Empty title="No automations fired" />)}
          </div>
        </Card>
      </div>
      {dlg === 'followup' && <FollowupDialog lead={l} lk={lk} onClose={() => setDlg(null)} onDone={() => { setDlg(null); d.reload(); }} />}
      {dlg === 'transfer' && <BulkDialog kind="transfer" ids={[l.id]} lk={lk} onClose={() => setDlg(null)} onDone={() => { setDlg(null); d.reload(); }} />}
      {dlg === 'delete' && <Confirm danger title="Delete this enquiry?" message="Its follow-ups and items will be removed too." confirmLabel="Delete" onClose={() => setDlg(null)} onConfirm={async () => { if (await run(() => api.del(`/leads/${l.id}`), 'Deleted')) nav('/leads'); }} />}
    </div>
  );
}

// ============================ Follow-up agenda ============================
export function Agenda() {
  const nav = useNavigate(); const lk = useLookups();
  const [start] = useState(ymd()); const [day, setDay] = useState(ymd()); const [mode, setMode] = useState('day'); const [fu, setFu] = useState(null);
  const ag = useFetch('/followups/agenda', { start });
  const params = mode === 'missed' ? { missed: 1, limit: 200 } : mode === 'non' ? { nonfollowup: 1, limit: 200 } : { next_from: day, next_to: day, tab: 'open', limit: 200 };
  const list = useFetch('/leads', params, [mode, day]);
  const a = ag.data;
  return (
    <div className="page">
      <PageHead title="Follow-up agenda" sub="Who to call today and what slipped." />
      {a && (
        <div className="agenda-strip mb">
          {a.days.map((x) => <button key={x.date} className={mode === 'day' && day === x.date ? 'active' : ''} onClick={() => { setMode('day'); setDay(x.date); }}><span className="small muted">{x.date === ymd() ? 'Today' : new Date(x.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>{x.count}</b></button>)}
          <button className={mode === 'missed' ? 'active' : ''} onClick={() => setMode('missed')}><span className="small" style={{ color: 'var(--bad)' }}>Missed</span><b>{a.missed}</b></button>
          <button className={mode === 'non' ? 'active' : ''} onClick={() => setMode('non')}><span className="small muted">No follow-up</span><b>{a.nonfollowup}</b></button>
        </div>
      )}
      <Card flush>
        {!list.data ? <Loading d={list} /> : <DataTable rows={list.data.rows} empty={<Empty title="Nothing scheduled" sub="No leads in this bucket." />} sortable={false} columns={[
          { key: 'number', label: '#', render: (r) => `#${r.number}` }, { key: 'customer', label: 'Customer', render: (r) => <><b>{r.customer}</b><div className="small muted">{r.phone}</div></> }, { key: 'items', label: 'Enquiry for' },
          { key: 'nature', label: 'Nature', render: (r) => <NatureBadge n={r.nature} /> }, { key: 'assignee', label: 'Executive' }, { key: 'next_followup', label: 'Due', render: dueBadge },
          { key: 'act', label: '', nosort: true, render: (r) => <div className="row"><button className="btn sm primary" onClick={(e) => { e.stopPropagation(); setFu(r); }}>Follow up</button><button className="btn sm" onClick={() => nav(`/leads/${r.id}`)}>Open</button></div> }]} />}
      </Card>
      {fu && <FollowupDialog lead={fu} lk={lk} onClose={() => setFu(null)} onDone={() => { setFu(null); list.reload(); ag.reload(); }} />}
    </div>
  );
}
