import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil, KeyRound, Upload, Download, Sparkles, Merge, Network, Users as UsersIcon, ShieldCheck, Building2, Tag, Boxes, Workflow, Settings2, Gift, Wallet, FileSpreadsheet, Check as CheckIcon, X } from 'lucide-react';
import { api, money, dateFmt, dateTime, downloadCsv } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, useToast, Loading, PageHead, Card, Tabs, Badge, DataTable, Modal, Input, Select, Textarea, Check, Switch, Empty, Avatar, Field, Stat, Bar, Confirm } from '../ui/kit.jsx';
import { useLookups } from './Leads.jsx';

// ================= Generic resource manager =================
const NATURE = ['followup', 'won', 'lost'];
const RES = {
  branches: { title: 'Branches', path: '/branches', perm: 'branches', cols: ['name', 'email', 'mobile', 'week_start'], fields: [{ k: 'name', req: 1 }, { k: 'email' }, { k: 'mobile' }, { k: 'address', t: 'textarea' }, { k: 'week_start', t: 'select', o: ['Monday', 'Sunday', 'Saturday'] }] },
  departments: { title: 'Departments', path: '/departments', perm: 'departments', cols: ['name'], fields: [{ k: 'name', req: 1 }, { k: 'parent_id', l: 'Parent department', t: 'ref', ref: '/departments' }] },
  designations: { title: 'Designations', path: '/designations', perm: 'designations', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  levels: { title: 'User levels', path: '/user-levels', perm: 'users', cols: ['name', 'sort'], fields: [{ k: 'name', req: 1 }, { k: 'sort', t: 'number' }, { k: 'dept_required', l: 'Department required', t: 'check' }, { k: 'multi_dept', l: 'Multiple departments', t: 'check' }] },
  teams: { title: 'Teams', path: '/teams', perm: 'teams', cols: ['name'], fields: [{ k: 'name', req: 1 }], members: true },
  category: { title: 'Item categories', path: '/lookups/category', perm: 'crm_item', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  group: { title: 'Item groups', path: '/lookups/group', perm: 'crm_item', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  brand: { title: 'Brands', path: '/lookups/brand', perm: 'crm_item', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  uom: { title: 'Units of measure', path: '/lookups/uom', perm: 'crm_item', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  packing: { title: 'Packing types', path: '/lookups/packing-types', perm: 'item_packing_types', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  terms: { title: 'Payment terms', path: '/lookups/payment-terms', perm: 'payment_term_master', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  dealers: { title: 'Dealers', path: '/lookups/dealers', perm: 'lead_management', cols: ['name'], fields: [{ k: 'name', req: 1 }] },
  items: { title: 'Items', path: '/items', perm: 'crm_item', cols: ['name', 'code', 'price'], fields: [{ k: 'name', req: 1 }, { k: 'code' }, { k: 'price', t: 'number' }, { k: 'category_id', l: 'Category', t: 'ref', ref: '/lookups/category' }, { k: 'brand_id', l: 'Brand', t: 'ref', ref: '/lookups/brand' }, { k: 'uom_id', l: 'Unit', t: 'ref', ref: '/lookups/uom' }, { k: 'show_in_enquiry', l: 'Show in enquiry form', t: 'check' }] },
  statuses: { title: 'Follow-up statuses', path: '/lead-statuses', perm: 'followup_status_master', cols: ['name', 'nature'], fields: [{ k: 'name', req: 1 }, { k: 'nature', t: 'select', o: NATURE }, { k: 'sort', t: 'number' }], merge: true },
  sources: { title: 'Lead sources', path: '/lead-sources', perm: 'lead_source_master', cols: ['name', 'priority', 'commission_enabled'], fields: [{ k: 'name', req: 1 }, { k: 'priority', t: 'select', o: ['Normal', 'High'] }, { k: 'commission_enabled', l: 'Pays commission', t: 'check' }, { k: 'commission_type', t: 'select', o: ['percent', 'fixed'] }, { k: 'commission_value', t: 'number' }], merge: true },
  templates: { title: 'Email templates', path: '/email-templates', perm: 'automation_master', cols: ['name', 'subject'], fields: [{ k: 'name', req: 1 }, { k: 'subject' }, { k: 'body', t: 'textarea' }] },
  automations: { title: 'Automations', path: '/automations', perm: 'automation_master', cols: ['trigger_on', 'medium', 'trigger_at', 'send_to', 'active'], fields: [{ k: 'trigger_on', req: 1, t: 'select', o: ['New Enquiry', 'Followup Added', 'Lead Won', 'Lead Lost', 'Quotation Sent'] }, { k: 'medium', t: 'select', o: ['Email', 'WhatsApp', 'SMS'] }, { k: 'template_id', l: 'Template', t: 'ref', ref: '/email-templates' }, { k: 'trigger_at', t: 'select', o: ['Immediately', '1 hour later', 'Next day'] }, { k: 'send_to', t: 'select', o: ['Customer', 'Executive', 'Both'] }, { k: 'active', t: 'check' }] },
  fields: { title: 'Custom fields', path: '/custom-fields', perm: 'custom_fields', cols: ['entity', 'name', 'field_type', 'section'], fields: [{ k: 'entity', t: 'select', o: ['Lead', 'Customer Profile', 'Item', 'Quotation'] }, { k: 'name', req: 1 }, { k: 'field_type', t: 'select', o: ['text', 'number', 'date', 'dropdown', 'checkbox'] }, { k: 'section' }, { k: 'sort', t: 'number' }, { k: 'options', hint: 'Comma separated, for dropdowns' }] },
  tags: { title: 'Field tags', path: '/field-tags', perm: 'custom_fields', cols: ['tag', 'field'], fields: [{ k: 'tag', req: 1 }, { k: 'field' }] },
  holidays: { title: 'Holidays', path: '/holidays', perm: 'calendar', cols: ['date', 'name'], fields: [{ k: 'date', t: 'date', req: 1 }, { k: 'name', req: 1 }] },
  reports: { title: 'Custom reports', path: '/custom-reports', perm: 'dynamic_report', cols: ['name', 'entity'], fields: [{ k: 'name', req: 1 }, { k: 'entity', t: 'select', o: ['leads', 'customers', 'tasks', 'quotations', 'items'] }, { k: 'columns', t: 'cols' }] },
};
const GROUPS = [
  ['Organisation', Building2, ['branches', 'departments', 'designations', 'levels', 'teams', 'holidays']],
  ['Catalogue', Boxes, ['items', 'category', 'group', 'brand', 'uom', 'packing', 'terms', 'dealers']],
  ['CRM setup', Tag, ['statuses', 'sources']],
  ['Automation', Workflow, ['templates', 'automations']],
  ['Customisation', Settings2, ['fields', 'tags', 'reports']],
];
const ENT_COLS = { leads: ['number', 'customer', 'phone', 'source', 'assignee', 'nature', 'quality', 'stage', 'business_value', 'place', 'created_at'], customers: ['display_name', 'type', 'level', 'phone', 'email', 'place', 'created_at'], tasks: ['title', 'type', 'priority', 'status', 'scheduled_at', 'host'], quotations: ['number', 'customer', 'date', 'valid_upto', 'total', 'status'], items: ['name', 'code', 'price'] };
const label = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function ResourceForm({ cfg, row, onClose, onDone }) {
  const run = useAction(); const [f, setF] = useState(row || {});
  const refs = cfg.fields.filter((x) => x.t === 'ref');
  const r1 = useFetch(refs[0]?.ref), r2 = useFetch(refs[1]?.ref), r3 = useFetch(refs[2]?.ref);
  const rd = { [refs[0]?.ref]: r1.data, [refs[1]?.ref]: r2.data, [refs[2]?.ref]: r3.data };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { const m = cfg.fields.find((x) => x.req && !f[x.k]); if (m) return run(async () => { throw new Error(`${m.l || label(m.k)} is required`); }); const body = { ...f }; for (const x of cfg.fields) if (x.t === 'check') body[x.k] = +!!f[x.k]; if (await run(() => (row ? api.put(`${cfg.path}/${row.id}`, body) : api.post(cfg.path, body)), 'Saved')) onDone(); };
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} · ${cfg.title}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <div className="col">{cfg.fields.map((x) => {
        const l = x.l || label(x.k), v = f[x.k] ?? '';
        if (x.t === 'check') return <Check key={x.k} label={l} checked={!!f[x.k]} onChange={(b) => set(x.k, b)} />;
        if (x.t === 'select') return <Select key={x.k} label={l} required={x.req} value={v} onChange={(e) => set(x.k, e.target.value)} placeholder="Choose" options={x.o} />;
        if (x.t === 'ref') return <Select key={x.k} label={l} value={v} onChange={(e) => set(x.k, +e.target.value || null)} placeholder="None" options={(rd[x.ref] || []).filter((o) => o.id !== row?.id).map((o) => ({ value: o.id, label: o.name }))} />;
        if (x.t === 'textarea') return <Textarea key={x.k} label={l} value={v} onChange={(e) => set(x.k, e.target.value)} />;
        if (x.t === 'cols') return <Field key={x.k} label="Columns"><div className="chips">{(ENT_COLS[f.entity] || []).map((c) => <span key={c} className={`chip ${(f.columns || []).includes(c) ? 'active' : ''}`} onClick={() => set('columns', (f.columns || []).includes(c) ? f.columns.filter((y) => y !== c) : [...(f.columns || []), c])}>{label(c)}</span>)}{!f.entity && <span className="muted small">Choose an entity first</span>}</div></Field>;
        return <Input key={x.k} label={l} required={x.req} hint={x.hint} type={x.t || 'text'} value={v} onChange={(e) => set(x.k, e.target.value)} />;
      })}</div>
    </Modal>
  );
}

function Resource({ id, onBack }) {
  const cfg = RES[id]; const { can } = useAuth(); const run = useAction(); const d = useFetch(cfg.path, undefined, [id]); const lk = useLookups();
  const [form, setForm] = useState(null); const [del, setDel] = useState(null); const [merge, setMerge] = useState(null); const [mem, setMem] = useState(null);
  const edit = can(cfg.perm, 'edit'), add = can(cfg.perm, 'add');
  const rows = d.data || [];
  const cell = (r, k) => (typeof r[k] === 'boolean' || k === 'active' || k === 'commission_enabled' ? <Badge kind={r[k] ? 'good' : ''}>{r[k] ? 'yes' : 'no'}</Badge> : k === 'nature' ? <Badge kind={{ won: 'good', lost: 'bad', followup: 'info' }[r[k]]}>{r[k]}</Badge> : r[k] ?? '—');
  return (
    <div className="page">
      <PageHead title={cfg.title} crumbs={<a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Masters</a>}>{add && <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add</button>}{cfg.merge && edit && <button className="btn" onClick={() => setMerge({ from_id: '', into_id: '' })}><Merge size={14} />Merge</button>}</PageHead>
      <Card flush>{!d.data ? <Loading d={d} /> : <DataTable rows={rows} empty={<Empty title="Nothing here yet" />} columns={[...cfg.cols.map((k) => ({ key: k, label: label(k), render: (r) => cell(r, k) })), { key: '_', label: '', nosort: true, render: (r) => <div className="row">
        {cfg.members && <button className="btn sm" onClick={async () => { const m = await api.get('/team-members'); setMem({ team: r, ids: m.filter((x) => x.team_id === r.id).map((x) => x.user_id) }); }}><UsersIcon size={12} />Members</button>}
        {edit && <button className="btn sm ghost" onClick={() => setForm(r)}><Pencil size={13} /></button>}{can(cfg.perm, 'delete') && <button className="btn sm ghost" onClick={() => setDel(r)}><Trash2 size={13} /></button>}</div> }]} />}</Card>
      {form && <ResourceForm cfg={cfg} row={form.id ? form : null} onClose={() => setForm(null)} onDone={() => { setForm(null); d.reload(); }} />}
      {del && <Confirm danger title={`Delete “${del.name || del.tag || del.trigger_on}”?`} message="Records that use it will lose the link." confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={async () => { await run(() => api.del(`${cfg.path}/${del.id}`), 'Deleted'); d.reload(); }} />}
      {merge && <Modal title={`Merge ${cfg.title.toLowerCase()}`} onClose={() => setMerge(null)} footer={<><button className="btn" onClick={() => setMerge(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post(`${cfg.path}/merge`, merge), 'Merged')) { setMerge(null); d.reload(); } }}>Merge</button></>}>
        <div className="col"><div className="alert">Every lead on the first one moves to the second, then the first is deleted.</div><Select label="Merge this…" value={merge.from_id} onChange={(e) => setMerge({ ...merge, from_id: +e.target.value })} placeholder="Choose" options={rows.map((x) => ({ value: x.id, label: x.name }))} /><Select label="…into" value={merge.into_id} onChange={(e) => setMerge({ ...merge, into_id: +e.target.value })} placeholder="Choose" options={rows.filter((x) => x.id !== merge.from_id).map((x) => ({ value: x.id, label: x.name }))} /></div></Modal>}
      {mem && <Modal title={`Members of ${mem.team.name}`} onClose={() => setMem(null)} footer={<><button className="btn" onClick={() => setMem(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.put(`/teams/${mem.team.id}/members`, { user_ids: mem.ids }), 'Team updated')) setMem(null); }}>Save</button></>}>
        <div className="chips">{lk.people.map((p) => <span key={p.id} className={`chip ${mem.ids.includes(p.id) ? 'active' : ''}`} onClick={() => setMem({ ...mem, ids: mem.ids.includes(p.id) ? mem.ids.filter((x) => x !== p.id) : [...mem.ids, p.id] })}>{p.name}</span>)}</div></Modal>}
    </div>
  );
}

export function Masters() {
  const { can } = useAuth(); const [cur, setCur] = useState(null);
  if (cur) return <Resource id={cur} onBack={() => setCur(null)} />;
  return (
    <div className="page">
      <PageHead title="Masters" sub="The building blocks every other screen uses." />
      {GROUPS.map(([g, I, ids]) => <div key={g} className="mb"><h3 className="row mb" style={{ fontSize: 15 }}><I size={16} />{g}</h3><div className="grid g4">{ids.filter((i) => can(RES[i].perm)).map((i) => <button key={i} className="card card-b" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setCur(i)}><b>{RES[i].title}</b><div className="small muted">Manage</div></button>)}</div></div>)}
    </div>
  );
}

// ================= Users =================
export function UsersPage() {
  const { can, user: me } = useAuth(); const run = useAction(); const toast = useToast(); const lk = useLookups(); const d = useFetch('/users');
  const roles = useFetch('/access-roles'); const lv = useFetch('/user-levels'); const dep = useFetch('/departments'); const des = useFetch('/designations');
  const [form, setForm] = useState(null); const [pw, setPw] = useState(null); const [del, setDel] = useState(null); const [org, setOrg] = useState(false); const [newPos, setNewPos] = useState(null);
  useEffect(() => { if (!form) setNewPos(null); }, [form]);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const x = d.data; const full = x.used >= x.limit; const list = x.users.filter((u) => u.active);
  const o = (a) => (a.data || []).map((i) => ({ value: i.id, label: i.name }));
  const save = async () => { const b = { ...form }; if (!form.id && !form.role_id) return toast('Choose an access role for this user', 'bad'); if (await run(() => (form.id ? api.put(`/users/${form.id}`, b) : api.post('/users', b)), 'User saved')) { setForm(null); d.reload(); lk.people; } };
  const addPos = async () => { const name = newPos.trim(); if (!name) return; const row = await run(() => api.post('/designations', { name }), 'Job position added'); if (row) { await des.reload(); setForm((f) => ({ ...f, designation_id: row.id })); setNewPos(null); } };
  const tree = (pid) => list.filter((u) => (u.reports_to || null) === pid && u.id !== pid);
  const Node = ({ u }) => <li><span className="node"><Avatar name={u.name} size="sm" /><span><b>{u.name}</b><div className="small muted">{u.designation || u.level || '—'}</div></span></span>{tree(u.id).length > 0 && <ul>{tree(u.id).map((c) => <Node key={c.id} u={c} />)}</ul>}</li>;
  return (
    <div className="page">
      <PageHead title="Users" sub="Seats are limited by your plan.">
        <button className="btn" onClick={() => setOrg(!org)}><Network size={14} />{org ? 'List' : 'Reporting tree'}</button>
        {can('users', 'add') && <button className="btn primary" disabled={full} title={full ? 'Every seat is taken' : ''} onClick={() => setForm({ name: '', username: '', password: '' })}><Plus size={15} />Add user</button>}</PageHead>
      <Card className="mb"><div className="row between"><b>Seats used {x.used} of {x.limit}</b>{full && <Badge kind="bad">Plan full</Badge>}</div><div className="mt"><Bar pct={(x.used / x.limit) * 100} color={full ? 'var(--bad)' : undefined} /></div>{full && <div className="small muted mt">Delete a user or upgrade your plan to add more.</div>}</Card>
      {org ? <Card title="Who reports to whom"><div className="org"><ul style={{ border: 0, paddingLeft: 0, margin: 0 }}>{list.filter((u) => !u.reports_to || !list.some((p) => p.id === u.reports_to)).map((u) => <Node key={u.id} u={u} />)}</ul></div></Card> :
        <Card flush><DataTable rows={list} columns={[{ key: 'name', label: 'User', render: (u) => <div className="row"><Avatar name={u.name} size="sm" /><div><b>{u.name}</b> {u.is_owner ? <Badge kind="brand">owner</Badge> : null}<div className="small muted">@{u.username}</div></div></div> },
          { key: 'designation', label: 'Designation' }, { key: 'role', label: 'Role', render: (u) => u.role || (u.is_owner ? 'Full access' : '—') }, { key: 'level', label: 'Level' }, { key: 'branch', label: 'Branch' }, { key: 'reports_to_name', label: 'Reports to' },
          { key: 'is_online', label: 'Status', render: (u) => <Badge kind={u.is_online ? 'good' : ''}>{u.is_online ? 'online' : 'offline'}</Badge> },
          { key: '_', label: '', nosort: true, render: (u) => <div className="row">{can('users', 'edit') && <button className="btn sm ghost" onClick={() => setForm(u)}><Pencil size={13} /></button>}{can('users', 'edit') && <button className="btn sm ghost" title="Reset password" onClick={() => setPw({ id: u.id, password: '' })}><KeyRound size={13} /></button>}{can('users', 'delete') && !u.is_owner && <button className="btn sm ghost" onClick={() => setDel(u)}><Trash2 size={13} /></button>}</div> }]} /></Card>}
      {form && <Modal title={form.id ? 'Edit user' : 'Add user'} size="lg" onClose={() => setForm(null)} footer={<><button className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
        <div className="field"><label>Access role{!form.id && ' *'}</label>
          <div className="role-pick">
            {(roles.data || []).map((r) => { const on = form.role_id === r.id; const mods = Object.values(r.permissions || {}).filter((p) => Object.values(p || {}).some(Boolean)).length;
              return <button type="button" key={r.id} className={`role-opt ${on ? 'on' : ''}`} onClick={() => setForm({ ...form, role_id: r.id })}><span className="role-ic"><ShieldCheck size={16} /></span><b>{r.name}</b><span className="small muted">{mods} modules</span>{on && <span className="role-tick"><CheckIcon size={12} /></span>}</button>; })}
            {form.id && <button type="button" className={`role-opt ${!form.role_id ? 'on' : ''}`} onClick={() => setForm({ ...form, role_id: null })}><span className="role-ic"><ShieldCheck size={16} /></span><b>No role</b><span className="small muted">no access</span>{!form.role_id && <span className="role-tick"><CheckIcon size={12} /></span>}</button>}
          </div>
          {!(roles.data || []).length && <div className="small muted mt">No roles yet — create one under Admin → Access Roles.</div>}</div>
        <div className="grid g2 mt"><Input label="Full name" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />{!form.id && <Input label="Username" required autoComplete="off" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />}
          {!form.id && <Input label="Password" required type="password" autoComplete="new-password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />}<Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Level" value={form.level_id || ''} onChange={(e) => setForm({ ...form, level_id: +e.target.value || null })} placeholder="—" options={o(lv)} />
          <Select label="Department" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: +e.target.value || null })} placeholder="—" options={o(dep)} /><div>
            <Select label="Job position" value={form.designation_id || ''} onChange={(e) => setForm({ ...form, designation_id: +e.target.value || null })} placeholder="—" options={o(des)} />
            {can('designations', 'add') && (newPos === null
              ? <button type="button" className="btn sm ghost mt" onClick={() => setNewPos('')}><Plus size={13} />New job position</button>
              : <div className="row mt"><input className="input grow" autoFocus placeholder="e.g. Site Supervisor" value={newPos} onChange={(e) => setNewPos(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPos(); } if (e.key === 'Escape') { e.stopPropagation(); setNewPos(null); } }} /><button type="button" className="btn sm primary" disabled={!newPos.trim()} onClick={addPos}>Add</button><button type="button" className="btn sm ghost" onClick={() => setNewPos(null)}><X size={13} /></button></div>)}
          </div>
          <Select label="Branch" value={form.branch_id || ''} onChange={(e) => setForm({ ...form, branch_id: +e.target.value || null })} placeholder="—" options={lk.branches.map((b) => ({ value: b.id, label: b.name }))} /><Select label="Reports to" value={form.reports_to || ''} onChange={(e) => setForm({ ...form, reports_to: +e.target.value || null })} placeholder="Nobody" options={lk.people.filter((p) => p.id !== form.id).map((p) => ({ value: p.id, label: p.name }))} /></div></Modal>}
      {pw && <Modal title="Reset password" onClose={() => setPw(null)} footer={<><button className="btn" onClick={() => setPw(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post(`/users/${pw.id}/reset-password`, { password: pw.password }), 'Password reset')) setPw(null); }}>Reset</button></>}><Input label="New password" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} hint="At least 6 characters" /></Modal>}
      {del && <Modal title={`Delete ${del.name}?`} onClose={() => setDel(null)} footer={<><button className="btn" onClick={() => setDel(null)}>Cancel</button><button className="btn danger" onClick={async () => { await run(() => api.del(`/users/${del.id}`, { reassign_to: del.reassign || me.id }), 'User removed'); setDel(null); d.reload(); }}>Delete</button></>}><div className="col"><div className="alert warn">Their open leads and tasks move to the person below, and the seat is freed.</div><Select label="Reassign to" value={del.reassign || me.id} onChange={(e) => setDel({ ...del, reassign: +e.target.value })} options={lk.people.filter((p) => p.id !== del.id).map((p) => ({ value: p.id, label: p.name }))} /></div></Modal>}
    </div>
  );
}

// ================= Roles =================
export function Roles() {
  const run = useAction(); const cat = useFetch('/permissions/catalogue'); const roles = useFetch('/access-roles'); const usage = useFetch('/access-roles-usage');
  const [cur, setCur] = useState(null); const [name, setName] = useState('');
  useEffect(() => { if (roles.data && !cur && roles.data.length) setCur(roles.data[0]); }, [roles.data]); // eslint-disable-line
  if (!cat.data || !roles.data) return <div className="page"><Loading d={roles} /></div>;
  const ACTS = ['view_all', 'add', 'edit', 'delete', 'confirm', 'export'];
  const perms = cur?.permissions || {}; const set = (key, a, v) => setCur({ ...cur, permissions: { ...perms, [key]: { ...(perms[key] || {}), [a]: v } } });
  const rowAll = (key, acts, v) => setCur({ ...cur, permissions: { ...perms, [key]: Object.fromEntries(acts.map((a) => [a, v])) } });
  const save = async () => { await run(() => api.put(`/access-roles/${cur.id}`, { name: cur.name, permissions: cur.permissions }), 'Role saved'); roles.reload(); };
  const used = (id) => (usage.data || []).find((u) => u.role_id === id)?.n || 0;
  return (
    <div className="page">
      <PageHead title="Access roles" sub="Pick what each role can see and do. Owners always have full access."><div className="row"><input className="input" placeholder="New role name" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn primary" onClick={async () => { if (!name) return; const r = await run(() => api.post('/access-roles', { name, permissions: {} }), 'Role created'); setName(''); await roles.reload(); if (r) setCur({ id: r.id, name, permissions: {} }); }}><Plus size={14} />Add role</button></div></PageHead>
      <div className="grid" style={{ gridTemplateColumns: '240px 1fr', alignItems: 'start' }}>
        <Card flush>{roles.data.map((r) => <div key={r.id} className={`thread ${cur?.id === r.id ? 'active' : ''}`} onClick={() => setCur(r)}><ShieldCheck size={16} /><div className="grow"><b>{r.name}</b><div className="small muted">{used(r.id)} user{used(r.id) === 1 ? '' : 's'}</div></div></div>)}</Card>
        {cur && <Card title={cur.name} actions={<><button className="btn sm danger" onClick={async () => { await run(() => api.del(`/access-roles/${cur.id}`), 'Deleted'); setCur(null); roles.reload(); }}>Delete</button><button className="btn sm primary" onClick={save}>Save changes</button></>} flush>
          <div className="table-wrap"><table className="t role-grid"><thead><tr><th>Permission</th>{ACTS.map((a) => <th key={a}>{label(a)}</th>)}<th>All</th></tr></thead><tbody>
            {cat.data.map((g) => [<tr key={g.name}><td colSpan={8} style={{ background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 800 }}>{g.name}</td></tr>, ...g.items.map((it) => <tr key={it.key}><td>{it.label}</td>{ACTS.map((a) => <td key={a}>{it.actions.includes(a) ? <input type="checkbox" checked={!!perms[it.key]?.[a]} onChange={(e) => set(it.key, a, e.target.checked)} /> : <span className="muted">·</span>}</td>)}<td><input type="checkbox" checked={it.actions.every((a) => perms[it.key]?.[a])} onChange={(e) => rowAll(it.key, it.actions, e.target.checked)} /></td></tr>)])}
          </tbody></table></div></Card>}
      </div>
    </div>
  );
}

// ================= Settings =================
const FLAGS = [['need_source', 'Lead source', 'require_source'], ['need_remark', 'Remark', 'require_remark'], ['need_quantity', 'Quantity', 'require_quantity'], ['need_item_description', 'Item description', 'require_item_description'], ['need_place', 'Place', 'require_place'], ['need_business_value', 'Business value', 'require_business_value'], ['need_lead_quality', 'Lead quality', 'require_lead_quality']];
export function SettingsPage() {
  const { user, refresh, can } = useAuth(); const run = useAction(); const lk = useLookups(); const d = useFetch('/settings'); const [tab, setTab] = useState('enquiry'); const [s, setS] = useState(null);
  useEffect(() => { if (d.data) setS(d.data); }, [d.data]);
  if (!s) return <div className="page"><Loading d={d} /></div>;
  const e = s.enquiry; const setE = (k, v) => setS({ ...s, enquiry: { ...e, [k]: v } }); const set = (sec, k, v) => setS({ ...s, [sec]: { ...s[sec], [k]: v } });
  const save = async (sec) => { await run(() => api.put(`/settings/${sec}`, s[sec]), 'Settings saved'); refresh(); };
  const Row = ({ k, label: l, hint }) => <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}><div><b>{l}</b>{hint && <div className="small muted">{hint}</div>}</div><Switch checked={!!e[k]} onChange={(v) => setE(k, v)} /></div>;
  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <PageHead title="Settings" sub="How enquiries, quotations and your company behave."><Tabs value={tab} onChange={setTab} tabs={[{ id: 'enquiry', label: 'Enquiry' }, { id: 'quotation', label: 'Quotation' }, { id: 'company', label: 'Company' }, { id: 'codes', label: 'Codes' }]} /></PageHead>
      {tab === 'enquiry' && (<div className="col">
        <Card title="Enquiry form fields" actions={<button className="btn primary sm" onClick={() => save('enquiry')}>Save</button>}>
          <div className="table-wrap"><table className="t"><thead><tr><th>Field</th><th className="center">Show</th><th className="center">Mandatory</th></tr></thead><tbody>{FLAGS.map(([n, l, r]) => <tr key={n}><td>{l}</td><td className="center"><Switch checked={e[n]} onChange={(v) => setE(n, v)} /></td><td className="center"><Switch checked={e[r]} disabled={!e[n]} onChange={(v) => setE(r, v)} /></td></tr>)}<tr><td>Follow-up remark</td><td className="center">—</td><td className="center"><Switch checked={e.require_followup_remark} onChange={(v) => setE('require_followup_remark', v)} /></td></tr></tbody></table></div></Card>
        <Card title="Assignment & rules" actions={<button className="btn primary sm" onClick={() => save('enquiry')}>Save</button>}>
          <Row k="assign_auto" label="Auto-assign new enquiries" hint="Round-robin across people who are online" /><Row k="prevent_active_followup" label="Block duplicates" hint="No new enquiry while the customer has an open follow-up" /><Row k="search_own_customers" label="Search only my customers" /><Row k="item_summary_home" label="Item summary on Home" /><Row k="lead_stage" label="Track lead stage" /><Row k="need_dealer" label="Ask for a dealer" /><Row k="ai_call_analysis" label="AI call analysis" />
          <div className="grid g3 mt"><Select label="Default task for new enquiry" value={e.default_task} onChange={(ev) => setE('default_task', ev.target.value)} options={['None', 'Offline Meeting', 'Online Meeting', 'Activity']} /><Select label="Target is measured on" value={e.target_basis} onChange={(ev) => setE('target_basis', ev.target.value)} options={['Business Value', 'Quotation Value', 'Profit Value']} /><Select label="Default customer type" value={e.default_customer_type} onChange={(ev) => setE('default_customer_type', ev.target.value)} options={['Individual', 'Business']} /></div></Card>
        <Card title="Response SLA" actions={<button className="btn primary sm" onClick={() => save('enquiry')}>Save</button>}>
          <div className="grid g2"><Input label="Respond within (minutes, 0 = off)" type="number" value={e.sla_minutes} onChange={(ev) => setE('sla_minutes', +ev.target.value)} hint="Breaches notify the executive and their manager." /><div className="col"><Row k="auto_reassign_sla" label="Auto-reassign on breach" hint="Moves the lead to another online executive" /></div></div>
          <Field label="Applies to sources (none = all)"><div className="chips">{lk.sources.map((x) => <span key={x.id} className={`chip ${(e.sla_sources || []).includes(x.id) ? 'active' : ''}`} onClick={() => setE('sla_sources', (e.sla_sources || []).includes(x.id) ? e.sla_sources.filter((y) => y !== x.id) : [...(e.sla_sources || []), x.id])}>{x.name}</span>)}</div></Field>
          <div className="mt"><button className="btn" onClick={async () => { await run(() => api.post('/sla/sweep'), 'Sweep complete'); }}>Run SLA sweep now</button></div></Card></div>)}
      {tab === 'quotation' && <Card title="Quotation" actions={<button className="btn primary sm" onClick={() => save('quotation')}>Save</button>}><div className="col"><Check label="Show quantity column" checked={s.quotation.quantity} onChange={(v) => set('quotation', 'quantity', v)} /><Check label="Ask for payment term" checked={s.quotation.payment_term} onChange={(v) => set('quotation', 'payment_term', v)} /><Textarea label="Default terms & conditions" rows={6} value={s.quotation.terms} onChange={(ev) => set('quotation', 'terms', ev.target.value)} /></div></Card>}
      {tab === 'company' && <Card title="Company" actions={<button className="btn primary sm" onClick={() => save('company')}>Save</button>}><div className="grid g2"><Input label="Company name" value={s.company.name} onChange={(ev) => set('company', 'name', ev.target.value)} /><Input label="PAN" value={s.company.pan} onChange={(ev) => set('company', 'pan', ev.target.value)} /><Input label="TAN" value={s.company.tan} onChange={(ev) => set('company', 'tan', ev.target.value)} /><Input label="PF code" value={s.company.pf_code} onChange={(ev) => set('company', 'pf_code', ev.target.value)} /><Input label="ESI code" value={s.company.esi_code} onChange={(ev) => set('company', 'esi_code', ev.target.value)} /><Input label="PT number" value={s.company.pt_no} onChange={(ev) => set('company', 'pt_no', ev.target.value)} /></div><div className="mt"><Textarea label="Address" value={s.company.address} onChange={(ev) => set('company', 'address', ev.target.value)} /></div></Card>}
      {tab === 'codes' && <Card title="Numbering" actions={<button className="btn primary sm" onClick={() => save('codes')}>Save</button>}><div className="grid g2"><Input label="Employee prefix" value={s.codes.employee_prefix} onChange={(ev) => set('codes', 'employee_prefix', ev.target.value)} /><Input label="Next employee number" type="number" value={s.codes.employee_next} onChange={(ev) => set('codes', 'employee_next', +ev.target.value)} /><Input label="Job prefix" value={s.codes.job_prefix} onChange={(ev) => set('codes', 'job_prefix', ev.target.value)} /><Input label="Next job number" type="number" value={s.codes.job_next} onChange={(ev) => set('codes', 'job_next', +ev.target.value)} /></div><div className="mt"><Check label="Use a separate series for interns" checked={s.codes.intern_separate} onChange={(v) => set('codes', 'intern_separate', v)} /></div></Card>}
    </div>
  );
}

// ================= Import =================
const parseCsv = (text) => {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; } else cur += c; }
  if (cur || row.length) { row.push(cur); if (row.some((x) => x.trim())) rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
};
export function ImportPage() {
  const run = useAction(); const [ent, setEnt] = useState('individual'); const [rows, setRows] = useState(null); const [file, setFile] = useState(''); const [res, setRes] = useState(null); const hist = useFetch('/import/history', {}, [res]);
  const tpl = useFetch(`/import/template/${ent}`, undefined, [ent]);
  const onFile = async (e) => { const f = e.target.files[0]; if (!f) return; setFile(f.name); setRows(parseCsv(await f.text())); setRes(null); };
  const ENTS = [['individual', 'Individual customers'], ['business', 'Business customers'], ['enquiry', 'Enquiries'], ['items', 'Items']];
  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <PageHead title="Import data" sub="Upload a CSV — we check every row and tell you exactly which ones failed." />
      <Card className="mb"><div className="col"><Tabs value={ent} onChange={(v) => { setEnt(v); setRows(null); setRes(null); }} tabs={ENTS.map(([id, label]) => ({ id, label }))} />
        <div className="row wrap"><button className="btn" onClick={() => tpl.data && downloadCsv(`${ent}-template`, tpl.data.columns.map((c) => ({ key: c, label: c })), [])}><Download size={14} />Download template</button>
          <label className="btn primary" style={{ cursor: 'pointer' }}><Upload size={14} />Choose CSV<input type="file" accept=".csv" hidden onChange={onFile} /></label>{file && <span className="small muted">{file} · {rows?.length || 0} rows</span>}</div>
        {tpl.data && <div className="small muted">Columns: {tpl.data.columns.join(', ')}</div>}
        {rows && <><DataTable rows={rows.slice(0, 8).map((r, i) => ({ id: i, ...r }))} columns={Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k, nosort: true }))} dense /><div><button className="btn primary" onClick={async () => { const r = await run(() => api.post(`/import/${ent}`, { rows, file })); if (r) setRes(r); }}>Import {rows.length} rows</button></div></>}
        {res && <div className={`alert ${res.errors.length ? 'warn' : 'good'}`}><b>{res.imported} imported</b>{res.errors.length > 0 && <> · {res.errors.length} failed<ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{res.errors.slice(0, 12).map((x, i) => <li key={i}>Line {x.line}: {x.error}</li>)}</ul></>}</div>}</div></Card>
      <Card title="Import history" flush><DataTable rows={hist.data || []} empty={<Empty title="No imports yet" icon={FileSpreadsheet} />} columns={[{ key: 'created_at', label: 'When', render: (r) => dateTime(r.created_at) }, { key: 'entity', label: 'Type' }, { key: 'file', label: 'File' }, { key: 'status', label: 'Result', render: (r) => <Badge kind={r.status === 'Imported' ? 'good' : r.status === 'Failed' ? 'bad' : 'warn'}>{r.status}</Badge> }, { key: 'errors', label: 'Errors', right: true }, { key: 'by_name', label: 'By' }]} /></Card>
    </div>
  );
}

// ================= Tokens / billing / audit / support / what's new / profile =================
export function Tokens() {
  const run = useAction(); const d = useFetch('/tokens'); const toast = useToast();
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const x = d.data; const total = x.free + x.purchased;
  return (
    <div className="page">
      <PageHead title="AI tokens" sub="Powers the assistant and call analysis." />
      <div className="grid g4 mb"><Stat label="Remaining" value={Number(x.remaining).toLocaleString('en-IN')} tone="good" icon={Sparkles} /><Stat label="Used" value={Number(x.used).toLocaleString('en-IN')} /><Stat label="Free allowance" value={Number(x.free).toLocaleString('en-IN')} tone="info" /><Stat label="Purchased" value={Number(x.purchased).toLocaleString('en-IN')} tone="accent" /></div>
      <Card className="mb"><Bar pct={(x.used / total) * 100} /></Card>
      <div className="grid g3 mb">{x.packs.map((p) => <Card key={p.id} title={p.name}><b style={{ fontSize: 26 }}>{money(p.price)}</b><div className="small muted">{Number(p.tokens).toLocaleString('en-IN')} tokens</div><button className="btn primary mt" onClick={async () => { const r = await run(() => api.post('/tokens/buy', { pack: p.id })); if (r) toast(r.message); d.reload(); }}>Buy</button></Card>)}</div>
      <Card title="Usage" flush><DataTable rows={x.usage} empty={<Empty title="No usage yet" />} columns={[{ key: 'created_at', label: 'When', render: (r) => dateTime(r.created_at) }, { key: 'feature', label: 'Feature' }, { key: 'operation', label: 'Operation' }, { key: 'by', label: 'By' }, { key: 'tokens', label: 'Tokens', right: true }]} /></Card>
    </div>
  );
}

export function Billing() {
  const d = useFetch('/billing');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const x = d.data;
  return (
    <div className="page">
      <PageHead title="Plan & billing" />
      <div className="grid g3 mb"><Card title="Plan"><b style={{ fontSize: 22 }}>{x.plan}</b><div className="small muted">{x.cycle} · renews {dateFmt(x.renewal)}</div></Card><Card title="Seats"><b style={{ fontSize: 22 }}>{x.users.used} / {x.users.limit}</b><div className="mt"><Bar pct={(x.users.used / x.users.limit) * 100} /></div></Card><Card title="Next invoice"><b style={{ fontSize: 22 }}>{money(x.total)}</b><div className="small muted">{money(x.price)} + {money(x.tax)} tax</div></Card></div>
      <Card title="Invoices" flush><DataTable rows={x.invoices} empty={<Empty title="No invoices" />} columns={[{ key: 'no', label: 'Invoice', render: (r) => `#${r.no}` }, { key: 'date', label: 'Date', render: (r) => dateFmt(r.date) }, { key: 'period', label: 'Period' }, { key: 'amount', label: 'Amount', right: true, render: (r) => money(r.amount) }, { key: 'status', label: 'Status', render: (r) => <Badge kind={r.status === 'Paid' ? 'good' : 'warn'}>{r.status}</Badge> }]} /></Card>
    </div>
  );
}

export function Audit() {
  const [q, setQ] = useState(''); const d = useFetch('/audit', { limit: 300 });
  const rows = (d.data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <PageHead title="Audit log" sub="Who changed what, and when."><input className="input" style={{ width: 240 }} placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} /></PageHead>
      <Card flush>{!d.data ? <Loading d={d} /> : <DataTable rows={rows} columns={[{ key: 'created_at', label: 'When', render: (r) => dateTime(r.created_at) }, { key: 'user', label: 'User' }, { key: 'action', label: 'Action', render: (r) => <Badge kind={{ Added: 'good', Deleted: 'bad', Edited: 'info' }[r.action]}>{r.action}</Badge> }, { key: 'entity', label: 'Record' }, { key: 'label', label: 'Detail' }]} />}</Card>
    </div>
  );
}

export function Support() {
  const { can } = useAuth(); const run = useAction(); const d = useFetch('/complaints'); const [f, setF] = useState(null);
  return (
    <div className="page">
      <PageHead title="Support" sub="Raise a question or complaint."><button className="btn primary" onClick={() => setF({ subject: '', type: 'Query', priority: 'Normal', details: '' })}><Plus size={15} />New ticket</button></PageHead>
      <Card flush>{!d.data ? <Loading d={d} /> : <DataTable rows={d.data} empty={<Empty title="No tickets" />} columns={[{ key: 'created_at', label: 'Raised', render: (r) => dateTime(r.created_at) }, { key: 'subject', label: 'Subject', render: (r) => <b>{r.subject}</b> }, { key: 'type', label: 'Type' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status', render: (r) => <Badge kind={r.status === 'Open' ? 'warn' : 'good'}>{r.status}</Badge> }, { key: 'reply', label: 'Reply', render: (r) => r.reply || '—' }]} />}</Card>
      {f && <Modal title="New ticket" onClose={() => setF(null)} footer={<><button className="btn" onClick={() => setF(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post('/complaints', { ...f, status: 'Open' }), 'Ticket raised')) { setF(null); d.reload(); } }}>Submit</button></>}>
        <div className="col"><Input label="Subject" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /><div className="grid g2"><Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={['Query', 'Complaint', 'Feature request']} /><Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={['Normal', 'High']} /></div><Textarea label="Details" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></div></Modal>}
    </div>
  );
}

export function WhatsNew() {
  const d = useFetch('/whats-new');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHead title="What’s new" sub={`Orbit CRM ${d.data.version} · ${dateFmt(d.data.date)}`} />
      <div className="col">{d.data.sections.map((s) => <Card key={s.module} title={s.module}><ul style={{ margin: 0, paddingLeft: 18 }}>{s.items.map((i) => <li key={i} style={{ marginBottom: 4 }}>{i}</li>)}</ul></Card>)}</div>
    </div>
  );
}

export function Profile() {
  const { user, refresh, lang, setLang, theme, setTheme } = useAuth(); const run = useAction();
  const [p, setP] = useState({ name: user.name, phone: user.phone || '', email: user.email || '' }); const [pw, setPw] = useState({ current: '', next: '' });
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHead title="My profile" />
      <div className="col">
        <Card title="Details" actions={<button className="btn primary sm" onClick={async () => { await run(() => api.patch('/auth/me', p), 'Profile updated'); refresh(); }}>Save</button>}><div className="row mb"><Avatar name={user.name} size="lg" /><div><b>{user.name}</b><div className="small muted">@{user.username} · {user.tenant.name}</div></div></div><div className="grid g2"><Input label="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /><Input label="Phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /><Input label="Email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></div></Card>
        <Card title="Preferences"><div className="grid g2"><Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /><Select label="Language" value={lang} onChange={(e) => setLang(e.target.value)} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية (RTL)' }]} /></div></Card>
        <Card title="Change password" actions={<button className="btn primary sm" onClick={async () => { if (await run(() => api.post('/auth/change-password', pw), 'Password changed')) setPw({ current: '', next: '' }); }}>Update</button>}><div className="grid g2"><Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><Input label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div></Card>
      </div>
    </div>
  );
}
