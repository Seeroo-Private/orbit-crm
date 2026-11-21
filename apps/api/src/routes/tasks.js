import { ah, need, crud, newRouter, notify, visibleUsers, inList, q, one, run, now, audit } from '../core.js';
import { periodRange, rangeSql, ymd, addDays, startOfWeek } from '../lib.js';

const r = newRouter();
const T = (req) => req.user.tenant_id;
const js = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

const TSEL = `SELECT t.*, h.name host, c.display_name party, c.phone party_phone, cb.name added_by,
  (SELECT GROUP_CONCAT(u.name,', ') FROM task_participants p JOIN users u ON u.id=p.user_id WHERE p.task_id=t.id) participants
  FROM tasks t LEFT JOIN users h ON h.id=t.host_id LEFT JOIN customers c ON c.id=t.party_id LEFT JOIN users cb ON cb.id=t.created_by`;
const shape = (t) => {
  const meta = js(t.custom, {});
  let secs = t.seconds_worked || 0;
  if (t.status === 'running' && meta.run_since) secs += Math.max(0, Math.floor((Date.now() - meta.run_since) / 1000));
  const delayed = t.status !== 'done' && t.scheduled_at && t.scheduled_at < new Date(Date.now() - 60000).toISOString().slice(0, 16) && t.status === 'pending';
  return { ...t, checklist: js(t.checklist, []), meta, seconds: secs, delayed: !!delayed || (t.status !== 'done' && t.deadline && t.deadline < new Date().toISOString().slice(0, 16)) };
};
// local-time ISO-ish string comparisons: store scheduled_at as 'YYYY-MM-DDTHH:mm' local
const localNow = () => { const d = new Date(); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function scopeSql(req, scope, p) {
  const t = T(req);
  let w = ' WHERE t.tenant_id=?'; p.push(t);
  const me = req.user.id;
  if (scope === 'my') { w += ' AND (t.host_id=? OR t.id IN (SELECT task_id FROM task_participants WHERE user_id=?))'; p.push(me, me); }
  else if (scope === 'delegated') { w += ' AND t.created_by=? AND (t.host_id IS NULL OR t.host_id<>?)'; p.push(me, me); }
  else if (scope === 'team') {
    const ids = visibleUsers(req.user, 'task_management') || null;
    if (ids) w += ` AND t.host_id IN (${inList(ids)}) AND t.host_id<>?`, p.push(me);
    else w += ' AND t.host_id<>?', p.push(me);
  } else { const ids = visibleUsers(req.user, 'task_management'); if (ids) w += ` AND (t.host_id IN (${inList(ids)}) OR t.created_by=?)`, p.push(me); }
  return w;
}
function filters(req, p) {
  const f = req.query; let w = '';
  if (f.status) { w += ' AND t.status=?'; p.push(f.status); }
  if (f.type) { w += ' AND t.type=?'; p.push(f.type); }
  if (f.priority) { w += ' AND t.priority=?'; p.push(f.priority); }
  if (f.host) { w += ' AND t.host_id=?'; p.push(f.host); }
  if (f.party) { w += ' AND t.party_id=?'; p.push(f.party); }
  if (f.q) { w += ' AND (t.title LIKE ? OR c.display_name LIKE ?)'; p.push(`%${f.q}%`, `%${f.q}%`); }
  w += rangeSql('COALESCE(t.scheduled_at,t.created_at)', periodRange(f.period, f.from, f.to), p);
  return w;
}

r.get('/tasks', need('task_management', 'view'), ah((req, res) => {
  const p = []; const w = scopeSql(req, req.query.scope || 'my', p) + filters(req, p);
  res.json(q(`${TSEL}${w} ORDER BY COALESCE(t.scheduled_at,t.created_at) ASC LIMIT 1000`, ...p).map(shape));
}));

// week board for My Tasks
r.get('/tasks/week', need('task_management', 'view'), ah((req, res) => {
  const start = startOfWeek(req.query.start ? new Date(req.query.start + 'T00:00') : new Date());
  const from = ymd(start), to = ymd(addDays(start, 6));
  const p = []; let w = scopeSql(req, req.query.scope || 'my', p);
  if (req.query.type) { w += ' AND t.type=?'; p.push(req.query.type); }
  if (req.query.q) { w += ' AND t.title LIKE ?'; p.push(`%${req.query.q}%`); }
  const rows = q(`${TSEL}${w} ORDER BY t.scheduled_at`, ...p).map(shape);
  const nowStr = localNow();
  const inWeek = rows.filter((t) => t.scheduled_at && t.scheduled_at.slice(0, 10) >= from && t.scheduled_at.slice(0, 10) <= to && (req.query.completed === '1' || t.status !== 'done'));
  res.json({
    from, to, tasks: inWeek,
    delayed: rows.filter((t) => t.status !== 'done' && t.scheduled_at && t.scheduled_at < nowStr && t.status === 'pending'),
    unscheduled: rows.filter((t) => t.status !== 'done' && !t.scheduled_at),
  });
}));

r.get('/tasks/dashboard', need('task_management', 'view'), ah((req, res) => {
  const out = {};
  for (const scope of ['my', 'delegated', 'team']) {
    const p = []; const w = scopeSql(req, scope, p) + filters(req, p);
    const rows = q(`SELECT t.* FROM tasks t LEFT JOIN customers c ON c.id=t.party_id ${w}`, ...p);
    const nowStr = localNow();
    const bucket = (fn) => Object.fromEntries(['High', 'Medium', 'Normal'].map((pr) => [pr, rows.filter((t) => t.priority === pr && fn(t)).length]));
    out[scope] = {
      Pending: bucket((t) => t.status === 'pending' && t.scheduled_at && t.scheduled_at >= nowStr || t.status === 'running' || t.status === 'hold'),
      Completed: bucket((t) => t.status === 'done'),
      Delayed: bucket((t) => t.status === 'pending' && t.scheduled_at && t.scheduled_at < nowStr),
      Unscheduled: bucket((t) => t.status === 'pending' && !t.scheduled_at),
    };
  }
  res.json(out);
}));

r.get('/tasks/timeline', need('task_management', 'view'), ah((req, res) => {
  const t = T(req), p = []; const w = scopeSql(req, 'my', p);
  const nowStr = localNow();
  const tasks = q(`${TSEL}${w} AND t.status<>'done' ORDER BY t.scheduled_at`, ...p).map(shape);
  const collections = q("SELECT l.id,l.number,c.display_name customer,l.business_value,l.collected FROM leads l JOIN customers c ON c.id=l.customer_id WHERE l.tenant_id=? AND l.nature='Won' AND l.collected<l.business_value", t);
  res.json({ delayed: tasks.filter((x) => x.scheduled_at && x.scheduled_at < nowStr && x.status === 'pending'), upcoming: tasks.filter((x) => !x.scheduled_at || x.scheduled_at >= nowStr || x.status !== 'pending'), collections });
}));

r.get('/tasks/todo', need('task_management', 'view'), ah((req, res) => {
  const date = req.query.date || ymd(), p = [T(req), date];
  let w = "t.tenant_id=? AND substr(t.scheduled_at,1,10)=?";
  const ids = visibleUsers(req.user, 'task_management'); if (ids) w += ` AND t.host_id IN (${inList(ids)})`;
  if (req.query.user) { w += ' AND t.host_id=?'; p.push(req.query.user); }
  if (req.query.team) { w += ' AND t.host_id IN (SELECT user_id FROM team_members WHERE team_id=?)'; p.push(req.query.team); }
  res.json(q(`${TSEL} WHERE ${w} ORDER BY t.scheduled_at`, ...p).map(shape));
}));

r.get('/calendar', need('calendar', 'view'), ah((req, res) => {
  const t = T(req), from = req.query.from || ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to = req.query.to || ymd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const p = []; const w = scopeSql(req, req.query.scope === 'team' ? 'team' : 'my', p) + ` AND substr(t.scheduled_at,1,10)>=? AND substr(t.scheduled_at,1,10)<=?`;
  res.json({
    tasks: q(`${TSEL}${w}`, ...p, from, to).map(shape),
    leaves: q('SELECT l.*, u.name user FROM leaves l JOIN users u ON u.id=l.user_id WHERE l.tenant_id=? AND l.to_date>=? AND l.from_date<=?', t, from, to),
    holidays: q('SELECT * FROM holidays WHERE tenant_id=? AND date>=? AND date<=?', t, from, to),
  });
}));
r.post('/leaves', ah((req, res) => {
  const b = req.body; if (!b.from_date || !b.to_date) return res.status(400).json({ error: 'Choose dates' });
  const i = run('INSERT INTO leaves(tenant_id,user_id,from_date,to_date,kind,status) VALUES(?,?,?,?,?,?)', T(req), b.user_id || req.user.id, b.from_date, b.to_date, b.kind || 'Casual', b.status || 'Pending');
  res.json({ id: i.lastInsertRowid });
}));

// ---- create / update ----
function insertTask(req, b, extra = {}) {
  const t = T(req);
  const mode = b.mode || 'instant';
  const host = b.host_id || req.user.id;
  const running = mode === 'instant';
  const scheduled = running ? localNow() : b.scheduled_at || null;
  const meta = running ? { run_since: Date.now() } : {};
  const link = b.meet ? `https://meet.example.com/${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 5)}` : null;
  const id = run(`INSERT INTO tasks(tenant_id,type,priority,title,description,mode,status,scheduled_at,started_at,deadline,host_id,party_id,lead_id,checklist,notify_done,repeat_rule,meet_link,created_by,custom,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  t, b.type, b.priority || 'Normal', b.title || b.type, b.description, mode, running ? 'running' : 'pending', scheduled, running ? now() : null, b.deadline || null, host, b.party_id || null, b.lead_id || null, JSON.stringify((b.checklist || []).map((c) => (typeof c === 'string' ? { text: c, done: false } : c))), +!!b.notify_done, b.repeat ? JSON.stringify(b.repeat) : null, link, req.user.id, JSON.stringify({ ...meta, ...extra }), now()).lastInsertRowid;
  run('INSERT OR IGNORE INTO task_participants VALUES(?,?,?)', id, host, 'Host');
  for (const u of b.participants || []) run('INSERT OR IGNORE INTO task_participants VALUES(?,?,?)', id, u, 'Member');
  for (const u of [host, ...(b.participants || [])]) if (u !== req.user.id) notify(t, u, 'Task assigned to you', b.title || b.type, '/my-tasks', 'task');
  audit(req, 'Added', 'task', id, b.title || b.type);
  return id;
}
r.post('/tasks', need('task_management', 'add'), ah((req, res) => {
  const b = req.body;
  if (!b.type) return res.status(400).json({ error: 'Task type is required' });
  if (!b.title && !b.description) return res.status(400).json({ error: 'Give the task a title' });
  if (b.mode === 'later' && !b.scheduled_at) return res.status(400).json({ error: 'Choose when the task is scheduled' });
  const ids = [insertTask(req, b)];
  if (b.mode === 'repeat' && b.repeat?.count > 1 && b.scheduled_at) {
    const base = new Date(b.scheduled_at);
    for (let i = 1; i < Math.min(b.repeat.count, 60); i++) {
      const d = new Date(base);
      if (b.repeat.freq === 'weekly') d.setDate(d.getDate() + 7 * i); else if (b.repeat.freq === 'monthly') d.setMonth(d.getMonth() + i); else d.setDate(d.getDate() + i);
      const iso = `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      ids.push(insertTask(req, { ...b, mode: 'later', scheduled_at: iso }));
    }
  }
  res.json({ id: ids[0], created: ids.length });
}));

r.get('/tasks/:id', need('task_management', 'view'), ah((req, res) => {
  const x = one(`${TSEL} WHERE t.id=? AND t.tenant_id=?`, req.params.id, T(req));
  if (!x) return res.status(404).json({ error: 'Not found' });
  res.json({ ...shape(x), people: q('SELECT p.role, u.id, u.name FROM task_participants p JOIN users u ON u.id=p.user_id WHERE p.task_id=?', x.id), notes: q('SELECT n.*, u.name user FROM task_notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.task_id=? ORDER BY n.id', x.id), history: q("SELECT a.*, u.name user FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.entity LIKE 'task%' AND a.record_id=? ORDER BY a.id", x.id) });
}));
r.put('/tasks/:id', need('task_management', 'edit'), ah((req, res) => {
  const b = req.body, cur = one('SELECT * FROM tasks WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!cur) return res.status(404).json({ error: 'Not found' });
  run(`UPDATE tasks SET type=?,priority=?,title=?,description=?,scheduled_at=?,deadline=?,host_id=?,party_id=?,checklist=? WHERE id=?`,
    b.type ?? cur.type, b.priority ?? cur.priority, b.title ?? cur.title, b.description ?? cur.description, b.scheduled_at === undefined ? cur.scheduled_at : b.scheduled_at, b.deadline === undefined ? cur.deadline : b.deadline, b.host_id ?? cur.host_id, b.party_id ?? cur.party_id, b.checklist ? JSON.stringify(b.checklist) : cur.checklist, cur.id);
  if (b.participants) { run("DELETE FROM task_participants WHERE task_id=? AND role<>'Host'", cur.id); for (const u of b.participants) run('INSERT OR IGNORE INTO task_participants VALUES(?,?,?)', cur.id, u, 'Member'); }
  audit(req, 'Edited', 'task', cur.id, cur.title);
  res.json({ ok: true });
}));
r.delete('/tasks/:id', need('task_management', 'delete'), ah((req, res) => {
  run('DELETE FROM task_participants WHERE task_id=?', req.params.id); run('DELETE FROM task_notes WHERE task_id=?', req.params.id);
  run('DELETE FROM tasks WHERE id=? AND tenant_id=?', req.params.id, T(req)); audit(req, 'Deleted', 'task', +req.params.id, ''); res.json({ ok: true });
}));

// ---- state machine: start / hold / resume / end ----
r.post('/tasks/:id/:action(start|hold|resume|end|reopen)', need('task_management', 'edit'), ah((req, res) => {
  const x = one('SELECT * FROM tasks WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!x) return res.status(404).json({ error: 'Not found' });
  const meta = js(x.custom, {}), a = req.params.action;
  const flush = () => (meta.run_since ? Math.max(0, Math.floor((Date.now() - meta.run_since) / 1000)) : 0);
  let secs = x.seconds_worked, status = x.status, started = x.started_at, ended = x.ended_at;
  if (a === 'start' || a === 'resume') { if (status === 'done') return res.status(400).json({ error: 'Task is already finished' }); status = 'running'; meta.run_since = Date.now(); started = started || now(); }
  if (a === 'hold') { if (status !== 'running') return res.status(400).json({ error: 'Task is not running' }); secs += flush(); meta.run_since = null; status = 'hold'; }
  if (a === 'end') {
    const open = js(x.checklist, []).filter((c) => !c.done);
    if (open.length && !req.body.force) return res.status(400).json({ error: `Tick all checklist items first (${open.length} left)` });
    if (status === 'running') secs += flush();
    meta.run_since = null; status = 'done'; ended = req.body.end_time ? new Date(req.body.end_time).toISOString() : now();
  }
  if (a === 'reopen') { status = 'pending'; ended = null; }
  run('UPDATE tasks SET status=?,seconds_worked=?,started_at=?,ended_at=?,custom=? WHERE id=?', status, secs, started, ended, JSON.stringify(meta), x.id);
  if (a === 'end' && x.notify_done && x.created_by !== req.user.id) notify(T(req), x.created_by, 'Task finished', x.title, '/my-tasks', 'task');
  audit(req, 'Edited', 'task history', x.id, a);
  res.json({ ok: true, status });
}));
r.post('/tasks/:id/notes', need('task_management', 'view'), ah((req, res) => {
  if (!req.body.text) return res.status(400).json({ error: 'Write a note' });
  run('INSERT INTO task_notes(task_id,user_id,text,created_at) VALUES(?,?,?,?)', req.params.id, req.user.id, req.body.text, now()); res.json({ ok: true });
}));
r.post('/tasks/:id/checklist', need('task_management', 'edit'), ah((req, res) => {
  const x = one('SELECT checklist FROM tasks WHERE id=? AND tenant_id=?', req.params.id, T(req));
  run('UPDATE tasks SET checklist=? WHERE id=?', JSON.stringify(req.body.checklist), req.params.id); res.json({ ok: true, prev: js(x.checklist, []) });
}));
r.post('/tasks/:id/reschedule', need('task_management', 'edit'), ah((req, res) => { run('UPDATE tasks SET scheduled_at=? WHERE id=? AND tenant_id=?', req.body.scheduled_at, req.params.id, T(req)); res.json({ ok: true }); }));

// ---- predefined task assignment ----
r.post('/tasks/assign-predefined', need('task_management', 'add'), ah((req, res) => {
  const b = req.body, pt = one('SELECT * FROM predefined_tasks WHERE id=? AND tenant_id=?', b.predefined_id, T(req));
  if (!pt) return res.status(400).json({ error: 'Choose a predefined task' });
  if (!b.task_type && !pt.task_type) return res.status(400).json({ error: 'Choose a task type' });
  const copies = Math.min(Math.max(+b.copies || 1, 1), 50), created = [];
  let at = b.deadline ? new Date(b.deadline) : new Date();
  for (let i = 1; i <= copies; i++) {
    const title = (b.name || pt.name) + (copies > 1 ? ` ${i}` : '');
    const sched = b.chain && i > 1 ? new Date(at.getTime() + (i - 1) * 864e5) : at;
    const iso = `${ymd(sched)}T${String(sched.getHours()).padStart(2, '0')}:${String(sched.getMinutes()).padStart(2, '0')}`;
    created.push(insertTask(req, { type: b.task_type || pt.task_type, title, description: pt.description, mode: 'later', scheduled_at: iso, deadline: b.deadline, host_id: (b.assignees || [])[0] || req.user.id, participants: (b.assignees || []).slice(1), party_id: b.party_id, checklist: js(pt.checklist, []) }));
  }
  res.json({ created: created.length });
}));

export default r;
