import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Plus, Star, Archive, Trash2, Inbox, Mail as MailIcon, FileEdit, Sparkles, MapPin, LogIn, LogOut, Users, Bell } from 'lucide-react';
import { api, dateTime, dateFmt } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, Loading, PageHead, Card, Badge, Modal, Input, Textarea, Empty, Avatar, Field, DataTable, Stat, AttendanceConfirm } from '../ui/kit.jsx';
import { useLookups } from './Leads.jsx';

// ================= Team chat =================
export function Chat() {
  const { user } = useAuth(); const lk = useLookups(); const run = useAction();
  const threads = useFetch('/chat/threads'); const [cur, setCur] = useState(null); const [text, setText] = useState(''); const [nw, setNw] = useState(null);
  const msgs = useFetch(cur ? `/chat/threads/${cur}/messages` : null, undefined, [cur]); const end = useRef();
  useEffect(() => { if (!cur && threads.data?.length) setCur(threads.data[0].id); }, [threads.data, cur]);
  useEffect(() => { end.current?.scrollIntoView(); }, [msgs.data]);
  useEffect(() => { const t = setInterval(() => { threads.reload(); if (cur) msgs.reload(); }, 5000); return () => clearInterval(t); }, [cur]); // eslint-disable-line
  const send = async () => { if (!text.trim()) return; const t = text; setText(''); await run(() => api.post(`/chat/threads/${cur}/messages`, { text: t })); msgs.reload(); threads.reload(); };
  const th = threads.data?.find((x) => x.id === cur);
  return (
    <div className="page">
      <PageHead title="Team chat" sub="Direct messages and groups.">
        <button className="btn primary" onClick={() => setNw({ ids: [], name: '' })}><Plus size={15} />New chat</button></PageHead>
      <Card flush><div className="split">
        <aside>{!threads.data ? <Loading d={threads} /> : threads.data.map((t) => (
          <div key={t.id} className={`thread ${cur === t.id ? 'active' : ''}`} onClick={() => setCur(t.id)}><Avatar name={t.name} /><div className="grow"><div className="row between"><b>{t.name}</b>{t.unread > 0 && <span className="badge accent">{t.unread}</span>}</div><div className="small muted truncate">{t.last ? `${t.last.user?.split(' ')[0]}: ${t.last.text}` : 'No messages yet'}</div></div></div>))}
          {threads.data && !threads.data.length && <Empty title="No chats yet" />}</aside>
        <section>{!cur ? <Empty title="Pick a conversation" /> : (<>
          <div className="row between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}><b>{th?.name}</b><span className="small muted">{th?.members.length} member{th?.members.length === 1 ? '' : 's'}</span></div>
          <div className="msgs">{(msgs.data || []).map((m) => <div key={m.id} className={`bubble ${m.user_id === user.id ? 'me' : ''}`}>{m.user_id !== user.id && th?.is_group ? <b className="small">{m.user}</b> : null}{m.text}<small>{dateTime(m.created_at)}</small></div>)}<div ref={end} /></div>
          <div className="composer"><input className="input" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} /><button className="btn primary" onClick={send}><Send size={15} /></button></div></>)}</section>
      </div></Card>
      {nw && <Modal title="New chat" onClose={() => setNw(null)} footer={<><button className="btn" onClick={() => setNw(null)}>Cancel</button><button className="btn primary" onClick={async () => { const r = await run(() => api.post('/chat/threads', { user_ids: nw.ids, name: nw.ids.length > 1 ? nw.name || 'Group' : undefined })); if (r) { setNw(null); await threads.reload(); setCur(r.id); } }}>Start</button></>}>
        <div className="col"><Field label="Choose people"><div className="chips">{lk.people.filter((p) => p.id !== user.id).map((p) => <span key={p.id} className={`chip ${nw.ids.includes(p.id) ? 'active' : ''}`} onClick={() => setNw({ ...nw, ids: nw.ids.includes(p.id) ? nw.ids.filter((x) => x !== p.id) : [...nw.ids, p.id] })}>{p.name}</span>)}</div></Field>
          {nw.ids.length > 1 && <Input label="Group name" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />}</div></Modal>}
    </div>
  );
}

// ================= Mail =================
export function Mail() {
  const { user } = useAuth(); const lk = useLookups(); const run = useAction();
  const [folder, setFolder] = useState('inbox'); const [qv, setQv] = useState(''); const list = useFetch('/mail', { folder, q: qv }); const [open, setOpen] = useState(null); const [compose, setCompose] = useState(null);
  const F = [['inbox', 'Inbox', Inbox], ['starred', 'Starred', Star], ['sent', 'Sent', Send], ['drafts', 'Drafts', FileEdit], ['archive', 'Archive', Archive], ['trash', 'Trash', Trash2]];
  const view = async (m) => { const x = await api.get(`/mail/${m.id}`); setOpen(x); list.reload(); };
  const patch = async (m, body) => { await api.patch(`/mail/${m.id}`, body); list.reload(); setOpen(null); };
  const send = async (draft) => { if (await run(() => api.post('/mail', { ...compose, draft }), draft ? 'Draft saved' : 'Mail sent')) { setCompose(null); list.reload(); } };
  return (
    <div className="page">
      <PageHead title="Mail" sub="Internal messages with your team."><button className="btn primary" onClick={() => setCompose({ to: [], subject: '', body: '' })}><Plus size={15} />Compose</button></PageHead>
      <Card flush><div className="split">
        <aside>{F.map(([k, l, I]) => <div key={k} className={`thread ${folder === k ? 'active' : ''}`} onClick={() => { setFolder(k); setOpen(null); }}><I size={17} /><b>{l}</b></div>)}
          <div style={{ padding: 12 }}><input className="input" placeholder="Search mail…" value={qv} onChange={(e) => setQv(e.target.value)} /></div></aside>
        <section style={{ overflow: 'auto' }}>
          {open ? (
            <div className="card-b"><div className="row between"><h2 style={{ fontSize: 20 }}>{open.subject}</h2><div className="row"><button className="btn sm" onClick={() => patch(open, { starred: !open.starred })}><Star size={13} /></button><button className="btn sm" onClick={() => patch(open, { archived: 1 })}><Archive size={13} /></button><button className="btn sm danger" onClick={() => patch(open, { trashed: 1 })}><Trash2 size={13} /></button><button className="btn sm" onClick={() => setOpen(null)}>Back</button></div></div>
              <div className="row mt"><Avatar name={open.from_name} /><div><b>{open.from_name}</b><div className="small muted">to {open.to_name || '—'} · {dateTime(open.created_at)}</div></div></div><div style={{ whiteSpace: 'pre-wrap', marginTop: 18 }}>{open.body}</div>
              <button className="btn mt" onClick={() => { setCompose({ to: [open.from_id], subject: `Re: ${open.subject}`, body: '' }); setOpen(null); }}>Reply</button></div>
          ) : !list.data ? <Loading d={list} /> : list.data.length ? list.data.map((m) => (
            <div key={m.id} className="thread" onClick={() => view(m)} style={{ fontWeight: !m.is_read && m.to_id === user.id ? 700 : 400 }}><Avatar name={folder === 'sent' ? m.to_name : m.from_name} /><div className="grow"><div className="row between"><span>{folder === 'sent' ? `To ${m.to_name || '—'}` : m.from_name}</span><span className="small muted">{dateTime(m.created_at)}</span></div><div className="truncate">{m.subject} <span className="muted small">— {m.body.slice(0, 70)}</span></div></div>{m.starred ? <Star size={14} fill="var(--warn)" color="var(--warn)" /> : null}</div>)) : <Empty title="Nothing in this folder" icon={MailIcon} />}
        </section>
      </div></Card>
      {compose && <Modal title="Compose" size="lg" onClose={() => setCompose(null)} footer={<><button className="btn" onClick={() => send(true)}>Save draft</button><button className="btn primary" onClick={() => send(false)}><Send size={14} />Send</button></>}>
        <div className="col"><Field label="To"><div className="chips">{lk.people.filter((p) => p.id !== user.id).map((p) => <span key={p.id} className={`chip ${compose.to.includes(p.id) ? 'active' : ''}`} onClick={() => setCompose({ ...compose, to: compose.to.includes(p.id) ? compose.to.filter((x) => x !== p.id) : [...compose.to, p.id] })}>{p.name}</span>)}</div></Field>
          <Input label="Subject" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /><Textarea label="Message" rows={8} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} /></div></Modal>}
    </div>
  );
}

// ================= AI assistant =================
export function Assistant() {
  const nav = useNavigate(); const run = useAction(); const [log, setLog] = useState([{ who: 'bot', text: 'Hi! Ask me about today’s follow-ups, delayed tasks or attendance — or say “Add a new lead” or “Add task”.' }]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const end = useRef();
  useEffect(() => { end.current?.scrollIntoView(); }, [log]);
  const ask = async (m) => {
    const msg = m || text; if (!msg.trim()) return; setText(''); setLog((l) => [...l, { who: 'me', text: msg }]); setBusy(true);
    const r = await run(() => api.post('/assistant', { message: msg })); setBusy(false);
    if (r) setLog((l) => [...l, { who: 'bot', text: r.reply, data: r.data, action: r.action, tokens: r.tokens }]);
  };
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <PageHead title="AI assistant" sub="Quick answers and quick actions. Each reply uses a few tokens." />
      <div className="chips mb">{['Followups due today', 'How many leads this week?', 'How many tasks are delayed?', 'Who all are present today?', 'Add a new lead', 'Add task'].map((s) => <span key={s} className="chip" onClick={() => ask(s)}>{s}</span>)}</div>
      <Card flush><div className="msgs" style={{ minHeight: 360, maxHeight: '55vh' }}>
        {log.map((m, i) => <div key={i} className={`bubble ${m.who === 'me' ? 'me' : ''}`} style={{ maxWidth: '82%' }}><div>{m.who === 'bot' && <Sparkles size={13} style={{ marginRight: 6, verticalAlign: -2 }} />}{m.text}</div>
          {m.data?.type === 'leads' && m.data.rows.map((l) => <div key={l.id} className="list-item small" style={{ cursor: 'pointer' }} onClick={() => nav(`/leads/${l.id}`)}><b>#{l.number}</b><span className="grow">{l.customer}</span><span className="muted">{dateTime(l.next_followup)}</span></div>)}
          {m.data?.type === 'table' && m.data.rows.map((r, j) => <div key={j} className="list-item small"><span className="grow">{r.name}</span><b>{r.n}</b></div>)}
          {m.action?.open && <button className="btn sm mt" onClick={() => nav(m.action.open)}>Open</button>}{m.tokens ? <small>{m.tokens} tokens</small> : null}</div>)}
        {busy && <div className="bubble">Thinking…</div>}<div ref={end} /></div>
        <div className="composer"><input className="input" placeholder="Ask anything about your work…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} /><button className="btn primary" onClick={() => ask()}><Send size={15} /></button></div></Card>
    </div>
  );
}

// ================= Attendance =================
export function Attendance() {
  const run = useAction(); const today = useFetch('/attendance/today'); const rep = useFetch('/reports/attendance', { period: 'month' }); const { can, user } = useAuth();
  const inn = today.data && !today.data.check_out; const [dlg, setDlg] = useState(false);
  return (
    <div className="page">
      <PageHead title="Attendance" sub="Check in when you start, check out when you finish." />
      <div className="grid g3 mb"><Card><div className="row between"><div><div className="small muted">TODAY</div><b style={{ fontSize: 20 }}>{!today.data ? 'Not checked in' : today.data.check_out ? 'Day complete' : 'Checked in'}</b>{today.data && <div className="small muted">In {dateTime(today.data.check_in)}{today.data.check_out && ` · Out ${dateTime(today.data.check_out)}`}</div>}</div>
        {(!today.data || inn) && <button className={`btn ${inn ? 'accent' : 'primary'}`} onClick={() => setDlg(true)}>{inn ? <><LogOut size={14} />Check out</> : <><LogIn size={14} />Check in</>}</button>}</div></Card></div>
      {dlg && <AttendanceConfirm checkedIn={inn} since={today.data?.check_in} name={user.name} onClose={() => setDlg(false)} onConfirm={async () => { await run(() => api.post(inn ? '/attendance/check-out' : '/attendance/check-in'), inn ? 'Checked out' : 'Checked in'); today.reload(); rep.reload(); }} />}
      {can('attendance_report') && <Card title="This month" flush>{!rep.data ? <Loading d={rep} /> : <DataTable rows={rep.data.rows.map((r, i) => ({ id: i, ...r }))} columns={[{ key: 'name', label: 'Employee', render: (r) => <b>{r.name}</b> }, { key: 'days', label: 'Days present', right: true }, { key: 'hours', label: 'Total hours', right: true }, { key: 'avg', label: 'Avg / day', right: true }]} />}</Card>}
    </div>
  );
}

// ================= Locations =================
export function Locations() {
  const d = useFetch('/locations');
  const pts = d.data || [];
  const lat0 = pts.length ? pts.reduce((a, b) => a + b.lat, 0) / pts.length : 10, lng0 = pts.length ? pts.reduce((a, b) => a + b.lng, 0) / pts.length : 76;
  return (
    <div className="page">
      <PageHead title="Team locations" sub="Last shared location of each person who has it switched on." />
      {!d.data ? <Loading d={d} /> : <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <Card title="Map">{pts.length ? <iframe title="map" style={{ width: '100%', height: 420, border: 0, borderRadius: 12 }} src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng0 - 0.4}%2C${lat0 - 0.3}%2C${lng0 + 0.4}%2C${lat0 + 0.3}&layer=mapnik&marker=${pts[0].lat}%2C${pts[0].lng}`} /> : <Empty title="No locations shared" icon={MapPin} />}</Card>
        <Card title="People">{pts.map((p) => <div className="list-item" key={p.user_id}><Avatar name={p.name} size="sm" /><div className="grow"><b>{p.name}</b><div className="small muted">{p.lat.toFixed(4)}, {p.lng.toFixed(4)} · {dateTime(p.updated_at)}</div></div><Badge kind={p.online ? 'good' : ''}>{p.online ? 'live' : 'idle'}</Badge></div>)}</Card></div>}
    </div>
  );
}

// ================= Notifications =================
export function Notifications() {
  const nav = useNavigate(); const d = useFetch('/notifications');
  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <PageHead title="Notifications"><button className="btn" onClick={async () => { await api.post('/notifications/read', {}); d.reload(); }}>Mark all read</button></PageHead>
      <Card flush>{!d.data ? <Loading d={d} /> : d.data.length ? d.data.map((n) => <div key={n.id} className="thread" style={{ opacity: n.is_read ? 0.6 : 1 }} onClick={async () => { await api.post('/notifications/read', { id: n.id }); nav(n.link || '/'); }}><Bell size={18} /><div className="grow"><b>{n.title}</b><div className="small muted">{n.body}</div></div><span className="small muted">{dateTime(n.created_at)}</span></div>) : <Empty title="All caught up" icon={Bell} />}</Card>
    </div>
  );
}
