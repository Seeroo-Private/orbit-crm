import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Play, Pause, Square, RotateCcw, Trash2, ChevronLeft, ChevronRight, Video, Clock, Check, Repeat, Zap, CalendarClock, ClipboardList } from 'lucide-react';
import { api, dateTime, localInput, addDays, ymd, dur } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, Loading, PageHead, Card, Tabs, Chips, Badge, DataTable, Drawer, Modal, Input, Select, Textarea, Check as Chk, Empty, SearchBox, Confirm, Field, Suggest, Avatar, STATUS_TONE } from '../ui/kit.jsx';
import { useLookups } from './Leads.jsx';

const TYPES = ['Call', 'Online Meeting', 'Offline Meeting', 'Activities'];
const PRI = ['Normal', 'Medium', 'High'];
const hhmm = (s) => (s ? s.slice(11, 16) : '');

function Timer({ task }) {
  const [t, setT] = useState(task.seconds); const base = useRef(Date.now());
  useEffect(() => { setT(task.seconds); base.current = Date.now(); }, [task.seconds, task.status]);
  useEffect(() => { if (task.status !== 'running') return; const i = setInterval(() => setT(task.seconds + Math.floor((Date.now() - base.current) / 1000)), 1000); return () => clearInterval(i); }, [task.status, task.seconds]);
  return <span className="num" style={{ fontWeight: 800, fontSize: 28, letterSpacing: '.02em' }}>{dur(t)}</span>;
}

// ---------- create / edit ----------
function TaskForm({ task, onClose, onDone, preset = {} }) {
  const run = useAction(); const lk = useLookups(); const { user } = useAuth();
  const [f, setF] = useState(task ? { ...task, participants: (task.people || []).filter((p) => p.role !== 'Host').map((p) => p.id), checklist: task.checklist || [] } : { type: 'Call', priority: 'Normal', title: '', description: '', mode: 'later', scheduled_at: localInput(addDays(new Date(), 0)).slice(0, 11) + '10:00', deadline: '', host_id: user.id, party_id: null, party_name: '', participants: [], checklist: [], meet: false, repeat: { freq: 'daily', count: 5 }, ...preset });
  const [ck, setCk] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(() => (task ? api.put(`/tasks/${task.id}`, f) : api.post('/tasks', { ...f, meet: f.type === 'Online Meeting' && f.meet })), task ? 'Task updated' : 'Task created');
  return (
    <Modal title={task ? 'Edit task' : 'New task'} size="lg" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { if (await save()) onDone(); }}>{task ? 'Save' : 'Create task'}</button></>}>
      <div className="col">
        {!task && <div className="tabs" style={{ alignSelf: 'flex-start' }}>{[['instant', 'Start now', Zap], ['later', 'Schedule', CalendarClock], ['repeat', 'Repeat', Repeat]].map(([m, l, I]) => <button key={m} className={f.mode === m ? 'active' : ''} onClick={() => setF({ ...f, mode: m })}><I size={14} />{l}</button>)}</div>}
        <div className="grid g3"><Select label="Type" required value={f.type} onChange={set('type')} options={TYPES} /><Select label="Priority" value={f.priority} onChange={set('priority')} options={PRI} />
          <Select label="Host" value={f.host_id} onChange={(e) => setF({ ...f, host_id: +e.target.value })} options={lk.people.map((p) => ({ value: p.id, label: p.name }))} /></div>
        <Input label="Title" required value={f.title || ''} onChange={set('title')} placeholder="What needs doing?" />
        <Textarea label="Details" value={f.description || ''} onChange={set('description')} />
        {f.mode !== 'instant' && <div className="grid g2"><Input label="Scheduled for" required type="datetime-local" value={f.scheduled_at || ''} onChange={set('scheduled_at')} /><Input label="Deadline" type="datetime-local" value={f.deadline || ''} onChange={set('deadline')} /></div>}
        {f.mode === 'repeat' && <div className="grid g2"><Select label="Repeats" value={f.repeat.freq} onChange={(e) => setF({ ...f, repeat: { ...f.repeat, freq: e.target.value } })} options={['daily', 'weekly', 'monthly']} /><Input label="Occurrences" type="number" min="2" max="60" value={f.repeat.count} onChange={(e) => setF({ ...f, repeat: { ...f.repeat, count: +e.target.value } })} /></div>}
        <Suggest label="Customer / party" value={f.party_name || ''} onChange={(v) => setF({ ...f, party_name: v, party_id: null })} placeholder="Optional — search a customer" fetcher={(v) => api.get('/customers/lookup', { q: v })} render={(c) => <><span>{c.display_name}</span><span className="muted small">{c.phone}</span></>} onPick={(c) => setF({ ...f, party_id: c.id, party_name: c.display_name })} />
        <Field label="Participants"><div className="chips">{lk.people.filter((p) => p.id !== f.host_id).map((p) => <span key={p.id} className={`chip ${f.participants.includes(p.id) ? 'active' : ''}`} onClick={() => setF({ ...f, participants: f.participants.includes(p.id) ? f.participants.filter((x) => x !== p.id) : [...f.participants, p.id] })}>{p.name}</span>)}</div></Field>
        {f.type === 'Online Meeting' && !task && <Chk label="Generate a meeting link" checked={f.meet} onChange={(v) => setF({ ...f, meet: v })} />}
        <Field label="Checklist"><div className="col gap-sm">{f.checklist.map((c, i) => <div key={i} className="row"><span className="grow">{c.text}</span><button className="btn sm ghost" onClick={() => setF({ ...f, checklist: f.checklist.filter((_, j) => j !== i) })}><Trash2 size={12} /></button></div>)}
          <div className="row"><input className="input" placeholder="Add an item and press Enter" value={ck} onChange={(e) => setCk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ck.trim()) { setF({ ...f, checklist: [...f.checklist, { text: ck.trim(), done: false }] }); setCk(''); } }} /></div></div></Field>
      </div>
    </Modal>
  );
}

// ---------- detail drawer ----------
export function TaskDrawer({ id, onClose, onChange }) {
  const run = useAction(); const d = useFetch(`/tasks/${id}`); const [note, setNote] = useState(''); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false);
  const act = async (a, body) => { await run(() => api.post(`/tasks/${id}/${a}`, body || {})); d.reload(); onChange(); };
  if (!d.data) return <Drawer title="Task" onClose={onClose}><Loading d={d} /></Drawer>;
  const t = d.data;
  const toggle = async (i) => { const cl = t.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)); await api.post(`/tasks/${id}/checklist`, { checklist: cl }); d.reload(); };
  return (
    <Drawer title={t.title} onClose={onClose}>
      <div className="col">
        <div className="row wrap"><Badge kind="info">{t.type}</Badge><Badge kind={STATUS_TONE[t.status]}>{t.status}</Badge><Badge kind={t.priority === 'High' ? 'bad' : t.priority === 'Medium' ? 'warn' : ''}>{t.priority}</Badge>{t.delayed && <Badge kind="bad">Delayed</Badge>}</div>
        <div className="card card-b center"><Timer task={t} /><div className="row mt" style={{ justifyContent: 'center' }}>
          {t.status === 'pending' && <button className="btn primary" onClick={() => act('start')}><Play size={14} />Start</button>}
          {t.status === 'running' && <button className="btn" onClick={() => act('hold')}><Pause size={14} />Hold</button>}
          {t.status === 'hold' && <button className="btn primary" onClick={() => act('resume')}><Play size={14} />Resume</button>}
          {(t.status === 'running' || t.status === 'hold') && <button className="btn accent" onClick={() => act('end')}><Square size={14} />End</button>}
          {t.status === 'done' && <button className="btn" onClick={() => act('reopen')}><RotateCcw size={14} />Reopen</button>}</div></div>
        {t.description && <div className="alert">{t.description}</div>}
        <dl className="kv"><dt>Host</dt><dd>{t.host}</dd><dt>Scheduled</dt><dd>{dateTime(t.scheduled_at)}</dd><dt>Deadline</dt><dd>{dateTime(t.deadline)}</dd><dt>Party</dt><dd>{t.party || '—'}</dd><dt>People</dt><dd>{t.people.map((p) => p.name).join(', ')}</dd>{t.meet_link && <><dt>Meeting</dt><dd><a href={t.meet_link} target="_blank" rel="noreferrer"><Video size={13} /> Join link</a></dd></>}</dl>
        {t.checklist.length > 0 && <Card title={`Checklist · ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}`}>{t.checklist.map((c, i) => <label className="check" key={i} style={{ marginBottom: 6 }}><input type="checkbox" checked={c.done} onChange={() => toggle(i)} /><span style={{ textDecoration: c.done ? 'line-through' : 'none' }}>{c.text}</span></label>)}</Card>}
        <Card title="Notes">{t.notes.map((n) => <div key={n.id} className="list-item" style={{ alignItems: 'flex-start' }}><Avatar name={n.user} size="sm" /><div><div className="small muted">{n.user} · {dateTime(n.created_at)}</div>{n.text}</div></div>)}
          <div className="row mt"><input className="input" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn primary" onClick={async () => { if (!note) return; await run(() => api.post(`/tasks/${id}/notes`, { text: note })); setNote(''); d.reload(); }}>Add</button></div></Card>
        <div className="row"><button className="btn" onClick={() => setEdit(true)}>Edit</button><button className="btn danger" onClick={() => setDel(true)}><Trash2 size={14} />Delete</button></div>
      </div>
      {edit && <TaskForm task={t} onClose={() => setEdit(false)} onDone={() => { setEdit(false); d.reload(); onChange(); }} />}
      {del && <Confirm danger title="Delete task?" message="This cannot be undone." confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={async () => { await run(() => api.del(`/tasks/${id}`), 'Deleted'); onClose(); onChange(); }} />}
    </Drawer>
  );
}

const TCard = ({ t, onOpen, draggable }) => (
  <div className={`tcard ${t.status} ${t.priority === 'High' ? 'High' : ''}`} onClick={() => onOpen(t.id)} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData('task', String(t.id))}>
    <div className="row between"><b>{t.title}</b>{t.status === 'running' && <span style={{ color: 'var(--good)' }}>●</span>}</div>
    <div className="muted">{t.type}{t.scheduled_at ? ` · ${hhmm(t.scheduled_at)}` : ''}{t.party ? ` · ${t.party}` : ''}</div>
  </div>
);

// ================= My tasks (week board) =================
export function MyTasks() {
  const [sp, setSp] = useSearchParams(); const { can } = useAuth(); const run = useAction();
  const [start, setStart] = useState(ymd()); const [type, setType] = useState(''); const [done, setDone] = useState(false); const [open, setOpen] = useState(null); const [form, setForm] = useState(sp.get('new') ? {} : null); const [over, setOver] = useState('');
  const d = useFetch('/tasks/week', { start, type, completed: done ? 1 : '' });
  useEffect(() => { if (sp.get('new')) setSp({}, { replace: true }); }, []); // eslint-disable-line
  const shift = (n) => setStart(ymd(addDays(new Date(start + 'T00:00'), n * 7)));
  const drop = async (e, day) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('task'); if (!id) return; const old = [...(d.data.tasks), ...d.data.delayed, ...d.data.unscheduled].find((x) => x.id === +id); const time = old?.scheduled_at ? hhmm(old.scheduled_at) : '10:00'; await run(() => api.post(`/tasks/${id}/reschedule`, { scheduled_at: `${day}T${time}` }), 'Rescheduled'); d.reload(); };
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(d.data.from + 'T00:00'), i)));
  return (
    <div className="page">
      <PageHead title="My tasks" sub="Drag a card onto a day to reschedule it.">
        <button className="btn" onClick={() => shift(-1)}><ChevronLeft size={15} /></button><button className="btn" onClick={() => setStart(ymd())}>This week</button><button className="btn" onClick={() => shift(1)}><ChevronRight size={15} /></button>
        <select className="input" style={{ width: 150 }} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <Chk label="Show completed" checked={done} onChange={setDone} />
        {can('task_management', 'add') && <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />New task</button>}
      </PageHead>
      {d.data.delayed.length > 0 && <Card title={`Delayed (${d.data.delayed.length})`} className="mb"><div className="grid g4">{d.data.delayed.map((t) => <TCard key={t.id} t={t} onOpen={setOpen} draggable />)}</div></Card>}
      <div className="week">{days.map((day) => (
        <div key={day} className={`day ${day === ymd() ? 'today' : ''} ${over === day ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(day); }} onDragLeave={() => setOver('')} onDrop={(e) => drop(e, day)}>
          <h4><span>{new Date(day + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="muted">{d.data.tasks.filter((t) => t.scheduled_at?.startsWith(day)).length}</span></h4>
          {d.data.tasks.filter((t) => t.scheduled_at?.startsWith(day)).map((t) => <TCard key={t.id} t={t} onOpen={setOpen} draggable />)}
        </div>))}</div>
      {d.data.unscheduled.length > 0 && <Card title={`Unscheduled (${d.data.unscheduled.length})`} className="mt"><div className="grid g4">{d.data.unscheduled.map((t) => <TCard key={t.id} t={t} onOpen={setOpen} draggable />)}</div></Card>}
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} onChange={d.reload} />}
      {form && <TaskForm preset={form} onClose={() => setForm(null)} onDone={() => { setForm(null); d.reload(); }} />}
    </div>
  );
}

// ================= Dashboard matrix =================
export function TaskDashboard() {
  const d = useFetch('/tasks/dashboard'); const [scope, setScope] = useState('my');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const m = d.data[scope]; const P = ['High', 'Medium', 'Normal'];
  const tone = { Pending: 'info', Completed: 'good', Delayed: 'bad', Unscheduled: 'warn' };
  return (
    <div className="page">
      <PageHead title="Task dashboard" sub="Status by priority."><Tabs value={scope} onChange={setScope} tabs={[{ id: 'my', label: 'Mine' }, { id: 'delegated', label: 'Delegated' }, { id: 'team', label: 'Team' }]} /></PageHead>
      <Card flush><table className="t"><thead><tr><th>Status</th>{P.map((p) => <th key={p} className="right">{p}</th>)}<th className="right">Total</th></tr></thead><tbody>
        {Object.entries(m).map(([k, v]) => <tr key={k}><td><Badge kind={tone[k]}>{k}</Badge></td>{P.map((p) => <td key={p} className="right num">{v[p]}</td>)}<td className="right"><b>{P.reduce((a, p) => a + v[p], 0)}</b></td></tr>)}</tbody></table></Card>
    </div>
  );
}

// ================= Team tasks =================
export function TeamTasks() {
  const lk = useLookups(); const [f, setF] = useState({ scope: 'team', status: '', host: '', q: '', period: '' }); const [open, setOpen] = useState(null);
  const d = useFetch('/tasks', f);
  return (
    <div className="page">
      <PageHead title="Team tasks" sub="What your reports and delegations are working on." />
      <Card flush>
        <div className="toolbar"><Tabs value={f.scope} onChange={(v) => setF({ ...f, scope: v })} tabs={[{ id: 'team', label: 'Team' }, { id: 'delegated', label: 'Delegated by me' }, { id: 'all', label: 'All visible' }]} /><div className="grow" />
          <select className="input" style={{ width: 130 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any status</option>{['pending', 'running', 'hold', 'done'].map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input" style={{ width: 150 }} value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })}><option value="">Any host</option>{lk.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <SearchBox value={f.q} onChange={(v) => setF({ ...f, q: v })} /></div>
        {!d.data ? <Loading d={d} /> : <DataTable rows={d.data} onRow={(r) => setOpen(r.id)} empty={<Empty title="No tasks" />} columns={[
          { key: 'title', label: 'Task', render: (r) => <><b>{r.title}</b><div className="small muted">{r.party}</div></> }, { key: 'type', label: 'Type', render: (r) => <Badge kind="info">{r.type}</Badge> }, { key: 'host', label: 'Host' },
          { key: 'priority', label: 'Priority' }, { key: 'scheduled_at', label: 'Scheduled', render: (r) => dateTime(r.scheduled_at) }, { key: 'status', label: 'Status', render: (r) => <Badge kind={r.delayed ? 'bad' : STATUS_TONE[r.status]}>{r.delayed ? 'delayed' : r.status}</Badge> }]} />}
      </Card>
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} onChange={d.reload} />}
    </div>
  );
}

// ================= To-do =================
export function Todo() {
  const lk = useLookups(); const [date, setDate] = useState(ymd()); const [user, setUser] = useState(''); const d = useFetch('/tasks/todo', { date, user }); const [open, setOpen] = useState(null);
  return (
    <div className="page">
      <PageHead title="To-do" sub="One day, chronologically."><button className="btn" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), -1)))}><ChevronLeft size={15} /></button><input className="input" type="date" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} /><button className="btn" onClick={() => setDate(ymd(addDays(new Date(date + 'T00:00'), 1)))}><ChevronRight size={15} /></button>
        <select className="input" style={{ width: 160 }} value={user} onChange={(e) => setUser(e.target.value)}><option value="">Everyone I can see</option>{lk.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></PageHead>
      <Card>{!d.data ? <Loading d={d} /> : d.data.length ? d.data.map((t) => <div className="list-item" key={t.id} onClick={() => setOpen(t.id)} style={{ cursor: 'pointer' }}><span className="num" style={{ width: 56, fontWeight: 700 }}>{hhmm(t.scheduled_at)}</span><Badge kind="info">{t.type}</Badge><div className="grow"><b>{t.title}</b><div className="small muted">{t.host}{t.party ? ` · ${t.party}` : ''}</div></div><Badge kind={STATUS_TONE[t.status]}>{t.status}</Badge></div>) : <Empty title="A clear day" sub="Nothing scheduled." />}</Card>
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} onChange={d.reload} />}
    </div>
  );
}

// ================= Timeline =================
export function Timeline() {
  const d = useFetch('/tasks/timeline'); const [open, setOpen] = useState(null);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const Row = ({ t }) => <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => setOpen(t.id)}><Badge kind="info">{t.type}</Badge><div className="grow"><b>{t.title}</b><div className="small muted">{t.party}</div></div><span className="small muted">{dateTime(t.scheduled_at)}</span></div>;
  return (
    <div className="page">
      <PageHead title="Timeline" sub="Delayed work, what is coming, and payments still to collect." />
      <div className="grid g3" style={{ alignItems: 'start' }}>
        <Card title={<span style={{ color: 'var(--bad)' }}>Delayed ({d.data.delayed.length})</span>}>{d.data.delayed.map((t) => <Row key={t.id} t={t} />)}{!d.data.delayed.length && <Empty title="None delayed" />}</Card>
        <Card title={`Upcoming (${d.data.upcoming.length})`}>{d.data.upcoming.map((t) => <Row key={t.id} t={t} />)}{!d.data.upcoming.length && <Empty title="Nothing upcoming" />}</Card>
        <Card title={`Collections (${d.data.collections.length})`}>{d.data.collections.map((c) => <div className="list-item" key={c.id}><div className="grow"><b>{c.customer}</b><div className="small muted">Enquiry #{c.number}</div></div><b className="num">₹{(c.business_value - c.collected).toLocaleString('en-IN')}</b></div>)}{!d.data.collections.length && <Empty title="All collected" />}</Card>
      </div>
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} onChange={d.reload} />}
    </div>
  );
}

// ================= Calendar =================
export function CalendarPage() {
  const [m, setM] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }); const [scope, setScope] = useState('my'); const run = useAction(); const [open, setOpen] = useState(null); const [leave, setLeave] = useState(null);
  const from = ymd(m), to = ymd(new Date(m.getFullYear(), m.getMonth() + 1, 0));
  const d = useFetch('/calendar', { from, to, scope });
  const first = (m.getDay() + 6) % 7; const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + dim) / 7) * 7 }, (_, i) => { const n = i - first + 1; return n >= 1 && n <= dim ? ymd(new Date(m.getFullYear(), m.getMonth(), n)) : null; });
  return (
    <div className="page">
      <PageHead title={m.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} sub="Tasks, leaves and holidays.">
        <button className="btn" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><button className="btn" onClick={() => setM(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button><button className="btn" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
        <Tabs value={scope} onChange={setScope} tabs={[{ id: 'my', label: 'Mine' }, { id: 'team', label: 'Team' }]} /><button className="btn" onClick={() => setLeave({ from_date: ymd(), to_date: ymd(), kind: 'Casual' })}>Apply leave</button></PageHead>
      <Card flush><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <div key={x} className="small muted center" style={{ padding: 8, fontWeight: 700 }}>{x}</div>)}
        {cells.map((day, i) => { const ts = day ? (d.data?.tasks || []).filter((t) => t.scheduled_at?.startsWith(day)) : []; const hol = day ? (d.data?.holidays || []).find((h) => h.date === day) : null; const lv = day ? (d.data?.leaves || []).filter((l) => l.from_date <= day && l.to_date >= day) : [];
          return <div key={i} style={{ minHeight: 104, borderTop: '1px solid var(--line-2)', borderLeft: i % 7 ? '1px solid var(--line-2)' : 0, padding: 6, background: day === ymd() ? 'var(--brand-soft)' : hol ? 'var(--warn-soft)' : 'transparent' }}>
            {day && <><b className="small">{+day.slice(8)}</b>{hol && <div className="small" style={{ color: 'var(--warn)' }}>{hol.name}</div>}{lv.map((l) => <div key={l.id} className="badge accent" style={{ display: 'flex', marginTop: 2 }}>{l.user.split(' ')[0]} · leave</div>)}
              {ts.slice(0, 3).map((t) => <div key={t.id} className={`tcard ${t.status}`} style={{ marginTop: 3, padding: '3px 6px' }} onClick={() => setOpen(t.id)}>{hhmm(t.scheduled_at)} {t.title}</div>)}{ts.length > 3 && <div className="small muted">+{ts.length - 3} more</div>}</>}
          </div>; })}
      </div></Card>
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} onChange={d.reload} />}
      {leave && <Modal title="Apply for leave" onClose={() => setLeave(null)} footer={<><button className="btn" onClick={() => setLeave(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post('/leaves', leave), 'Leave requested')) { setLeave(null); d.reload(); } }}>Apply</button></>}>
        <div className="col"><div className="grid g2"><Input label="From" type="date" value={leave.from_date} onChange={(e) => setLeave({ ...leave, from_date: e.target.value })} /><Input label="To" type="date" value={leave.to_date} onChange={(e) => setLeave({ ...leave, to_date: e.target.value })} /></div><Select label="Type" value={leave.kind} onChange={(e) => setLeave({ ...leave, kind: e.target.value })} options={['Casual', 'Sick', 'Earned', 'Unpaid']} /></div></Modal>}
    </div>
  );
}

// ================= Predefined tasks =================
export function PredefinedTasks() {
  const { can } = useAuth(); const run = useAction(); const lk = useLookups(); const d = useFetch('/predefined-tasks'); const [form, setForm] = useState(null); const [asg, setAsg] = useState(null);
  const save = async () => { const body = { ...form, checklist: form.checklist || [] }; if (await run(() => (form.id ? api.put(`/predefined-tasks/${form.id}`, body) : api.post('/predefined-tasks', body)), 'Saved')) { setForm(null); d.reload(); } };
  return (
    <div className="page">
      <PageHead title="Predefined tasks" sub="Reusable templates. Assign them in bulk, with copies and chained dates.">{can('predefined_tasks', 'add') && <button className="btn primary" onClick={() => setForm({ name: '', task_type: 'Activities', description: '', checklist: [] })}><Plus size={15} />New template</button>}</PageHead>
      <div className="grid g3">{(d.data || []).map((p) => { const cl = typeof p.checklist === 'string' ? JSON.parse(p.checklist || '[]') : p.checklist || []; return (
        <Card key={p.id} title={p.name} actions={<Badge kind="info">{p.task_type}</Badge>}><div className="small muted" style={{ minHeight: 36 }}>{p.description}</div>
          <ul className="small" style={{ paddingLeft: 18 }}>{cl.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
          <div className="row mt"><button className="btn sm primary" onClick={() => setAsg({ predefined_id: p.id, name: p.name, copies: 1, chain: false, assignees: [], deadline: '' })}><ClipboardList size={13} />Assign</button><button className="btn sm" onClick={() => setForm({ ...p, checklist: cl })}>Edit</button><button className="btn sm ghost" onClick={async () => { await run(() => api.del(`/predefined-tasks/${p.id}`)); d.reload(); }}><Trash2 size={13} /></button></div></Card>); })}
        {d.data && !d.data.length && <Empty title="No templates yet" />}</div>
      {form && <Modal title={form.id ? 'Edit template' : 'New template'} onClose={() => setForm(null)} footer={<><button className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
        <div className="col"><Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Select label="Task type" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} options={TYPES} /><Textarea label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label="Checklist (one per line)" value={(form.checklist || []).map((c) => c.text).join('\n')} onChange={(e) => setForm({ ...form, checklist: e.target.value.split('\n').filter(Boolean).map((t) => ({ text: t, done: false })) })} /></div></Modal>}
      {asg && <Modal title={`Assign “${asg.name}”`} onClose={() => setAsg(null)} footer={<><button className="btn" onClick={() => setAsg(null)}>Cancel</button><button className="btn primary" onClick={async () => { const r = await run(() => api.post('/tasks/assign-predefined', asg), 'Tasks assigned'); if (r) setAsg(null); }}>Assign</button></>}>
        <div className="col"><Input label="Copies" type="number" min="1" max="50" value={asg.copies} onChange={(e) => setAsg({ ...asg, copies: +e.target.value })} hint="Copies are numbered serially." /><Chk label="Chain copies one day apart" checked={asg.chain} onChange={(v) => setAsg({ ...asg, chain: v })} /><Input label="Start / deadline" type="datetime-local" value={asg.deadline} onChange={(e) => setAsg({ ...asg, deadline: e.target.value })} />
          <Field label="Assign to"><div className="chips">{lk.people.map((p) => <span key={p.id} className={`chip ${asg.assignees.includes(p.id) ? 'active' : ''}`} onClick={() => setAsg({ ...asg, assignees: asg.assignees.includes(p.id) ? asg.assignees.filter((x) => x !== p.id) : [...asg.assignees, p.id] })}>{p.name}</span>)}</div></Field></div></Modal>}
    </div>
  );
}
