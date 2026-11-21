import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Phone, Mail, MapPin, Ban, Trash2, Building2, User, ShieldCheck } from 'lucide-react';
import { api, money, dateTime, dateFmt } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, Loading, PageHead, Card, Tabs, Badge, NatureBadge, DataTable, Modal, Input, Select, Empty, SearchBox, Avatar, Confirm, Stat } from '../ui/kit.jsx';

const LEVELS = ['Suspect', 'Prospect', 'Customer'];
const LV_TONE = { Suspect: '', Prospect: 'warn', Customer: 'good' };

export function CustomerList() {
  const nav = useNavigate(); const { can } = useAuth(); const [lvl, setLvl] = useState(''); const [qv, setQv] = useState(''); const [field, setField] = useState(''); const [add, setAdd] = useState(false);
  const d = useFetch('/customers', { level: lvl, q: qv, field });
  const counts = d.data?.counts || {};
  const changes = useFetch(can('customers', 'edit') ? '/customer-changes' : null);
  const run = useAction();
  const pending = (changes.data || []).filter((x) => x.status === 'pending');
  return (
    <div className="page">
      <PageHead title="Customers" sub="Suspects, prospects and customers in one place.">{can('customers', 'add') && <button className="btn primary" onClick={() => setAdd(true)}><Plus size={15} />Add customer</button>}</PageHead>
      {pending.length > 0 && (
        <Card title="Change requests awaiting approval" className="mb">{pending.map((c) => (
          <div className="list-item" key={c.id}><ShieldCheck size={16} /><div className="grow"><b>{c.customer}</b> · {c.field.replace('_', ' ')}: <s className="muted">{c.old_value}</s> → <b>{c.new_value}</b><div className="small muted">by {c.requester}</div></div>
            <button className="btn sm primary" onClick={async () => { await run(() => api.post(`/customer-changes/${c.id}/approve`), 'Approved'); changes.reload(); d.reload(); }}>Approve</button>
            <button className="btn sm" onClick={async () => { await run(() => api.post(`/customer-changes/${c.id}/reject`), 'Rejected'); changes.reload(); }}>Reject</button></div>))}</Card>)}
      <Card flush>
        <div className="toolbar"><Tabs value={lvl} onChange={setLvl} tabs={[{ id: '', label: 'All', count: d.data?.total }, ...LEVELS.map((l) => ({ id: l, label: l + 's', count: counts[l] || 0 }))]} /><div className="grow" />
          <select className="input" style={{ width: 120 }} value={field} onChange={(e) => setField(e.target.value)}><option value="">Any field</option><option value="name">Name</option><option value="phone">Phone</option><option value="email">Email</option></select>
          <SearchBox value={qv} onChange={setQv} /></div>
        {!d.data ? <Loading d={d} /> : <DataTable rows={d.data.rows} onRow={(r) => nav(`/customers/${r.id}`)} empty={<Empty title="No customers found" />} columns={[
          { key: 'display_name', label: 'Customer', render: (r) => <div className="row"><Avatar name={r.display_name} size="sm" /><div><b>{r.display_name}</b>{r.blocked ? <Badge kind="bad"> blocked</Badge> : null}<div className="small muted">{r.type === 'business' ? 'Business' : 'Individual'}</div></div></div> },
          { key: 'phone', label: 'Phone', render: (r) => `${r.country_code || ''} ${r.phone || '—'}` }, { key: 'email', label: 'Email' }, { key: 'place', label: 'Place' },
          { key: 'level', label: 'Level', render: (r) => <Badge kind={LV_TONE[r.level]}>{r.level}</Badge> }, { key: 'enquiries', label: 'Enquiries', right: true }, { key: 'quotations', label: 'Quotes', right: true }, { key: 'owner', label: 'Owner' }]} />}
      </Card>
      {add && <CustomerForm onClose={() => setAdd(false)} onDone={(c) => { setAdd(false); nav(`/customers/${c.id}`); }} />}
    </div>
  );
}

function CustomerForm({ cust, onClose, onDone }) {
  const run = useAction();
  const [f, setF] = useState(cust || { type: 'individual', first_name: '', last_name: '', company: '', phone: '', email: '', place: '', level: 'Customer', secondary_phone: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(() => (cust ? api.put(`/customers/${cust.id}`, f).then(() => cust) : api.post('/customers', f)), 'Saved');
  return (
    <Modal title={cust ? 'Edit customer' : 'Add customer'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { const r = await save(); if (r) onDone(r); }}>Save</button></>}>
      <div className="col">
        <div className="tabs" style={{ alignSelf: 'flex-start' }}><button className={f.type === 'individual' ? 'active' : ''} onClick={() => setF({ ...f, type: 'individual' })}><User size={14} />Individual</button><button className={f.type === 'business' ? 'active' : ''} onClick={() => setF({ ...f, type: 'business' })}><Building2 size={14} />Business</button></div>
        {f.type === 'individual' ? <div className="grid g2"><Input label="First name" required value={f.first_name || ''} onChange={set('first_name')} /><Input label="Last name" value={f.last_name || ''} onChange={set('last_name')} /></div> : <Input label="Company name" required value={f.company || ''} onChange={(e) => setF({ ...f, company: e.target.value, display_name: e.target.value })} />}
        <div className="grid g2"><Input label="Phone" value={f.phone || ''} onChange={set('phone')} /><Input label="Secondary phone" value={f.secondary_phone || ''} onChange={set('secondary_phone')} /></div>
        <div className="grid g2"><Input label="Email" type="email" value={f.email || ''} onChange={set('email')} /><Input label="Place" value={f.place || ''} onChange={set('place')} /></div>
        <Select label="Level" value={f.level} onChange={set('level')} options={LEVELS} />
      </div>
    </Modal>
  );
}

export function CustomerDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth(); const run = useAction();
  const d = useFetch(`/customers/${id}`); const [tab, setTab] = useState('timeline'); const [dlg, setDlg] = useState(null);
  const [sub, setSub] = useState({});
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const c = d.data; const won = c.leads.filter((l) => l.nature === 'Won');
  const addSub = async () => {
    const path = dlg === 'contact' ? 'contacts' : 'addresses';
    if (await run(() => api.post(`/customers/${c.id}/${path}`, sub), 'Added')) { setDlg(null); setSub({}); d.reload(); }
  };
  return (
    <div className="page">
      <PageHead title={c.display_name} crumbs={<><Link to="/customers">Customers</Link> / {c.display_name}</>}>
        {can('lead_management', 'add') && <button className="btn primary" onClick={() => nav('/leads/new')}><Plus size={15} />New enquiry</button>}
        {can('customers', 'edit') && <button className="btn" onClick={() => setDlg('edit')}>Edit</button>}
        {can('customers', 'edit') && <button className="btn" onClick={async () => { await run(() => api.post(`/customers/${c.id}/block`, { blocked: !c.blocked }), c.blocked ? 'Unblocked' : 'Blocked'); d.reload(); }}><Ban size={15} />{c.blocked ? 'Unblock' : 'Block'}</button>}
        {can('customers', 'delete') && <button className="btn danger" onClick={() => setDlg('delete')}><Trash2 size={15} /></button>}
      </PageHead>
      <div className="grid g4 mb">
        <Card><div className="row"><Avatar name={c.display_name} size="lg" /><div><Badge kind={LV_TONE[c.level]}>{c.level}</Badge> {c.blocked ? <Badge kind="bad">Blocked</Badge> : null}<div className="small muted" style={{ marginTop: 4 }}>{c.type === 'business' ? 'Business' : 'Individual'} · owner {c.owner || '—'}</div></div></div></Card>
        <Stat label="Enquiries" value={c.leads.length} /><Stat label="Won value" value={money(won.reduce((a, b) => a + b.business_value, 0))} tone="good" /><Stat label="Quotations" value={c.quotations.length} tone="info" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', alignItems: 'start' }}>
        <div className="col">
          <Card title="Contact"><dl className="kv"><dt>Phone</dt><dd><Phone size={12} /> {c.country_code} {c.phone || '—'}</dd><dt>Secondary</dt><dd>{c.secondary_phone || '—'}</dd><dt>Email</dt><dd><Mail size={12} /> {c.email || '—'}</dd><dt>Place</dt><dd><MapPin size={12} /> {c.place || '—'}</dd></dl>
            {!can('customers', 'edit') && <button className="btn sm mt" onClick={() => setDlg('change')}>Request a change</button>}</Card>
          <Card title="Contact persons" actions={can('customers', 'edit') && <button className="btn sm" onClick={() => setDlg('contact')}><Plus size={12} />Add</button>}>
            {c.contacts.map((p) => <div className="list-item" key={p.id}><Avatar name={p.name} size="sm" /><div className="grow"><b>{p.name}</b><div className="small muted">{p.designation} · {p.phone}</div></div>{can('customers', 'edit') && <button className="btn sm ghost" onClick={async () => { await api.del(`/customers/${c.id}/contacts/${p.id}`); d.reload(); }}><Trash2 size={12} /></button>}</div>)}{!c.contacts.length && <div className="muted small">None added</div>}</Card>
          <Card title="Addresses" actions={can('customers', 'edit') && <button className="btn sm" onClick={() => setDlg('address')}><Plus size={12} />Add</button>}>
            {c.addresses.map((a) => <div className="list-item" key={a.id}><MapPin size={15} /><div className="grow small">{a.line1}, {a.city}, {a.state} {a.pincode}</div>{can('customers', 'edit') && <button className="btn sm ghost" onClick={async () => { await api.del(`/customers/${c.id}/addresses/${a.id}`); d.reload(); }}><Trash2 size={12} /></button>}</div>)}{!c.addresses.length && <div className="muted small">None added</div>}</Card>
        </div>
        <Card flush>
          <div className="toolbar"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'timeline', label: 'Timeline' }, { id: 'leads', label: 'Enquiries', count: c.leads.length }, { id: 'quotes', label: 'Quotations', count: c.quotations.length }, { id: 'tasks', label: 'Tasks', count: c.tasks.length }]} /></div>
          <div className="card-b">
            {tab === 'timeline' && (c.timeline.length ? <div className="timeline">{c.timeline.map((e, i) => <div className="tl" key={i}><div className="row between"><Badge kind="brand">{e.kind}</Badge><span className="small muted">{dateTime(e.at)}</span></div><div className="small" style={{ marginTop: 3 }}>{e.text}</div></div>)}</div> : <Empty title="No activity yet" />)}
            {tab === 'leads' && c.leads.map((l) => <div className="list-item" key={l.id}><Link to={`/leads/${l.id}`} className="grow"><b>#{l.number}</b> {l.items || ''}<div className="small muted">{l.assignee} · {dateFmt(l.created_at)}</div></Link><b>{money(l.business_value)}</b><NatureBadge n={l.nature} /></div>)}
            {tab === 'quotes' && c.quotations.map((x) => <div className="list-item" key={x.id}><Link to={`/quotations/${x.id}`} className="grow"><b>{x.number}</b> <span className="muted small">{dateFmt(x.date)}</span></Link><b>{money(x.total)}</b><Badge>{x.status}</Badge></div>)}
            {tab === 'tasks' && c.tasks.map((x) => <div className="list-item" key={x.id}><Badge kind="info">{x.type}</Badge><div className="grow">{x.title}</div><Badge>{x.status}</Badge></div>)}
          </div>
        </Card>
      </div>
      {dlg === 'edit' && <CustomerForm cust={c} onClose={() => setDlg(null)} onDone={() => { setDlg(null); d.reload(); }} />}
      {dlg === 'delete' && <Confirm danger title="Delete customer?" message="This only works when the customer has no enquiries." confirmLabel="Delete" onClose={() => setDlg(null)} onConfirm={async () => { if (await run(() => api.del(`/customers/${c.id}`), 'Deleted')) nav('/customers'); }} />}
      {(dlg === 'contact' || dlg === 'address') && (
        <Modal title={dlg === 'contact' ? 'Add contact person' : 'Add address'} onClose={() => setDlg(null)} footer={<><button className="btn" onClick={() => setDlg(null)}>Cancel</button><button className="btn primary" onClick={addSub}>Add</button></>}>
          <div className="col">{(dlg === 'contact' ? ['name', 'designation', 'phone', 'email'] : ['line1', 'city', 'state', 'pincode']).map((k) => <Input key={k} label={k === 'line1' ? 'Address' : k} value={sub[k] || ''} onChange={(e) => setSub({ ...sub, [k]: e.target.value })} />)}</div>
        </Modal>)}
      {dlg === 'change' && <Modal title="Request a change" onClose={() => setDlg(null)} footer={<><button className="btn" onClick={() => setDlg(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post(`/customers/${c.id}/request-change`, sub), 'Request sent for approval')) setDlg(null); }}>Send</button></>}><div className="col"><Select label="Field" value={sub.field || ''} onChange={(e) => setSub({ ...sub, field: e.target.value })} placeholder="Choose" options={[{ value: 'display_name', label: 'Name' }, { value: 'phone', label: 'Phone' }, { value: 'email', label: 'Email' }]} /><Input label="New value" value={sub.value || ''} onChange={(e) => setSub({ ...sub, value: e.target.value })} /></div></Modal>}
    </div>
  );
}
