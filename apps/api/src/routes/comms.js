import { ah, need, can, newRouter, notify, nextNumber, visibleUsers, inList, q, one, run, now, audit, db } from '../core.js';
import { settingsOf, tokenBalance } from './masters.js';
import { chargeTokens, ymd } from '../lib.js';

const r = newRouter();
const T = (req) => req.user.tenant_id;

// ====================== Notifications & badges ======================
r.get('/notifications', ah((req, res) => {
  const rows = q('SELECT * FROM notifications WHERE tenant_id=? AND user_id=? ORDER BY id DESC LIMIT 200', T(req), req.user.id);
  res.json(req.query.kind ? rows.filter((x) => x.kind === req.query.kind) : rows);
}));
r.get('/badges', ah((req, res) => {
  const t = T(req), me = req.user.id;
  res.json({
    notifications: one('SELECT COUNT(*) n FROM notifications WHERE tenant_id=? AND user_id=? AND is_read=0', t, me).n,
    mail: one('SELECT COUNT(*) n FROM mail WHERE tenant_id=? AND to_id=? AND is_read=0 AND is_draft=0 AND trashed=0', t, me).n,
    chat: one(`SELECT COUNT(DISTINCT m.thread_id) n FROM chat_messages m JOIN chat_members cm ON cm.thread_id=m.thread_id AND cm.user_id=? WHERE m.id>cm.last_read AND m.user_id<>?`, me, me).n,
  });
}));
r.post('/notifications/read', ah((req, res) => {
  if (req.body.id) run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', req.body.id, req.user.id);
  else run('UPDATE notifications SET is_read=1 WHERE user_id=?', req.user.id);
  res.json({ ok: true });
}));

// ====================== Mail ======================
const MSEL = 'SELECT m.*, f.name from_name, t.name to_name FROM mail m LEFT JOIN users f ON f.id=m.from_id LEFT JOIN users t ON t.id=m.to_id';
r.get('/mail', ah((req, res) => {
  const me = req.user.id, t = T(req), f = req.query.folder || 'inbox';
  const w = { inbox: 'm.to_id=? AND m.is_draft=0 AND m.trashed=0 AND m.archived=0', starred: 'm.to_id=? AND m.starred=1 AND m.trashed=0', sent: 'm.from_id=? AND m.is_draft=0', drafts: 'm.from_id=? AND m.is_draft=1', archive: 'm.to_id=? AND m.archived=1 AND m.trashed=0', trash: 'm.to_id=? AND m.trashed=1' }[f] || 'm.to_id=?';
  const rows = q(`${MSEL} WHERE m.tenant_id=? AND ${w} ${req.query.q ? 'AND (m.subject LIKE ? OR m.body LIKE ?)' : ''} ORDER BY m.id DESC LIMIT 200`, t, me, ...(req.query.q ? [`%${req.query.q}%`, `%${req.query.q}%`] : []));
  res.json(rows);
}));
r.get('/mail/:id', ah((req, res) => {
  const m = one(`${MSEL} WHERE m.id=? AND m.tenant_id=? AND (m.to_id=? OR m.from_id=?)`, req.params.id, T(req), req.user.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (m.to_id === req.user.id) run('UPDATE mail SET is_read=1 WHERE id=?', m.id);
  res.json(m);
}));
r.post('/mail', ah((req, res) => {
  const { to = [], subject, body, draft } = req.body, t = T(req);
  if (!draft && !to.length) return res.status(400).json({ error: 'Add at least one recipient' });
  if (!draft && !subject) return res.status(400).json({ error: 'Add a subject' });
  const targets = to.length ? to : [null];
  for (const uid of targets) {
    run('INSERT INTO mail(tenant_id,from_id,to_id,subject,body,is_draft,created_at) VALUES(?,?,?,?,?,?,?)', t, req.user.id, uid, subject || '(no subject)', body || '', +!!draft, now());
    if (!draft && uid) notify(t, uid, `New mail from ${req.user.name}`, subject, '/mail', 'mail');
  }
  res.json({ ok: true });
}));
r.patch('/mail/:id', ah((req, res) => {
  const allowed = ['starred', 'archived', 'trashed', 'is_read']; const b = req.body;
  for (const k of allowed) if (b[k] !== undefined) run(`UPDATE mail SET ${k}=? WHERE id=? AND tenant_id=? AND (to_id=? OR from_id=?)`, +!!b[k], req.params.id, T(req), req.user.id, req.user.id);
  res.json({ ok: true });
}));
r.delete('/mail/:id', ah((req, res) => { run('DELETE FROM mail WHERE id=? AND tenant_id=? AND (to_id=? OR from_id=?) AND (trashed=1 OR is_draft=1)', req.params.id, T(req), req.user.id, req.user.id); res.json({ ok: true }); }));

// ====================== Team chat ======================
r.get('/chat/threads', need('team_chat', 'view'), ah((req, res) => {
  const me = req.user.id, t = T(req);
  const ths = q('SELECT th.*, cm.last_read FROM chat_threads th JOIN chat_members cm ON cm.thread_id=th.id AND cm.user_id=? WHERE th.tenant_id=?', me, t);
  res.json(ths.map((th) => {
    const members = q('SELECT u.id,u.name FROM chat_members cm JOIN users u ON u.id=cm.user_id WHERE cm.thread_id=?', th.id);
    const last = one('SELECT m.*, u.name user FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.thread_id=? ORDER BY m.id DESC LIMIT 1', th.id);
    const unread = one('SELECT COUNT(*) n FROM chat_messages WHERE thread_id=? AND id>? AND user_id<>?', th.id, th.last_read, me).n;
    return { id: th.id, is_group: th.is_group, name: th.is_group ? th.name : members.find((m) => m.id !== me)?.name || 'Just you', members, last, unread };
  }).sort((a, b) => (b.last?.id || 0) - (a.last?.id || 0)));
}));
r.post('/chat/threads', need('team_chat', 'view'), ah((req, res) => {
  const me = req.user.id, t = T(req), ids = [...new Set([me, ...(req.body.user_ids || [])])];
  if (ids.length < 2 && !req.body.name) return res.status(400).json({ error: 'Pick at least one person' });
  if (ids.length === 2 && !req.body.name) {
    const ex = one(`SELECT th.id FROM chat_threads th WHERE th.tenant_id=? AND th.is_group=0 AND (SELECT COUNT(*) FROM chat_members WHERE thread_id=th.id)=2 AND EXISTS(SELECT 1 FROM chat_members WHERE thread_id=th.id AND user_id=?) AND EXISTS(SELECT 1 FROM chat_members WHERE thread_id=th.id AND user_id=?)`, t, ids[0], ids[1]);
    if (ex) return res.json({ id: ex.id });
  }
  const id = run('INSERT INTO chat_threads(tenant_id,name,is_group,created_at) VALUES(?,?,?,?)', t, req.body.name || null, ids.length > 2 || req.body.name ? 1 : 0, now()).lastInsertRowid;
  for (const u of ids) run('INSERT INTO chat_members(thread_id,user_id,last_read) VALUES(?,?,0)', id, u);
  res.json({ id });
}));
const inThread = (req) => one('SELECT 1 x FROM chat_members cm JOIN chat_threads th ON th.id=cm.thread_id WHERE cm.thread_id=? AND cm.user_id=? AND th.tenant_id=?', req.params.id, req.user.id, T(req));
r.get('/chat/threads/:id/messages', need('team_chat', 'view'), ah((req, res) => {
  if (!inThread(req)) return res.status(403).json({ error: 'Not in this chat' });
  const msgs = q('SELECT m.*, u.name user FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.thread_id=? ORDER BY m.id LIMIT 500', req.params.id);
  const last = msgs.length ? msgs[msgs.length - 1].id : 0;
  run('UPDATE chat_members SET last_read=? WHERE thread_id=? AND user_id=?', last, req.params.id, req.user.id);
  res.json(msgs);
}));
r.post('/chat/threads/:id/messages', need('team_chat', 'view'), ah((req, res) => {
  if (!inThread(req)) return res.status(403).json({ error: 'Not in this chat' });
  if (!req.body.text) return res.status(400).json({ error: 'Type a message' });
  const id = run('INSERT INTO chat_messages(thread_id,user_id,text,kind,created_at) VALUES(?,?,?,?,?)', req.params.id, req.user.id, req.body.text, req.body.kind || 'text', now()).lastInsertRowid;
  run('UPDATE chat_members SET last_read=? WHERE thread_id=? AND user_id=?', id, req.params.id, req.user.id);
  res.json({ id });
}));

// ====================== AI assistant (rule-based, token metered) ======================
const CHATS = new Map();
r.post('/assistant', need('ai_assistant', 'view'), ah((req, res) => {
  const t = T(req), me = req.user, msg = String(req.body.message || '').trim(), low = msg.toLowerCase();
  if (!msg) return res.status(400).json({ error: 'Ask something' });
  if (tokenBalance(t).remaining <= 0) return res.json({ reply: 'Your AI token balance is empty. Buy tokens under Master → AI Tokens.' });
  const today = ymd(), ids = visibleUsers(me), sc = ids ? ` AND l.assignee_id IN (${inList(ids)})` : '';
  let reply = '', data = null, action = null;
  const draft = CHATS.get(me.id);
  if (draft) {
    // multi-step: collecting fields for add lead / add task
    if (/^(cancel|stop|never ?mind)/.test(low)) { CHATS.delete(me.id); reply = 'Cancelled.'; }
    else if (draft.kind === 'lead') {
      if (!draft.name) { draft.name = msg; reply = `What is ${msg}'s phone number?`; }
      else if (!draft.phone) {
        const ph = msg.replace(/\D/g, ''); if (ph.length < 6) reply = 'That does not look like a phone number. Try again, or say cancel.';
        else {
          draft.phone = ph; CHATS.delete(me.id);
          let c = one('SELECT * FROM customers WHERE tenant_id=? AND phone=?', t, ph);
          if (!c) c = { id: run('INSERT INTO customers(tenant_id,type,display_name,phone,level,owner_id,created_at) VALUES(?,?,?,?,?,?,?)', t, 'individual', draft.name, ph, 'Prospect', me.id, now()).lastInsertRowid };
          const num = nextNumber(t, 'leads');
          const id = run("INSERT INTO leads(tenant_id,number,customer_id,branch_id,assignee_id,nature,stage,created_by,created_at,updated_at,next_followup) VALUES(?,?,?,?,?,?,?,?,?,?,?)", t, num, c.id, me.branch_id, me.id, 'New', 'New', me.id, now(), now(), `${ymd(new Date(Date.now() + 864e5))}T10:00`).lastInsertRowid;
          reply = `Done — lead #${num} created for ${draft.name}, assigned to you with a follow-up tomorrow at 10:00.`; action = { open: `/leads/${id}` };
        }
      }
    } else if (draft.kind === 'task') {
      draft.title = msg; CHATS.delete(me.id);
      const id = run("INSERT INTO tasks(tenant_id,type,priority,title,mode,status,scheduled_at,host_id,checklist,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", t, draft.type, 'Normal', msg, 'later', 'pending', `${draft.when || ymd()}T${draft.time || '10:00'}`, me.id, '[]', me.id, now()).lastInsertRowid;
      reply = `Task created: “${msg}” (${draft.type}) for ${draft.when || 'today'} at ${draft.time || '10:00'}.`; action = { open: '/my-tasks' };
    }
  } else if (/add (a )?(new )?lead|new lead/.test(low)) { CHATS.set(me.id, { kind: 'lead' }); reply = 'Sure. What is the customer’s name?'; }
  else if (/add (a )?task|create (a )?task/.test(low)) {
    const type = /meeting/.test(low) ? 'Offline Meeting' : /online/.test(low) ? 'Online Meeting' : /call/.test(low) ? 'Call' : 'Activities';
    const when = /tomorrow/.test(low) ? ymd(new Date(Date.now() + 864e5)) : ymd(); const tm = low.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    const time = tm ? `${String(((+tm[1] % 12) + (tm[3] === 'pm' ? 12 : 0))).padStart(2, '0')}:${tm[2] || '00'}` : '10:00';
    CHATS.set(me.id, { kind: 'task', type, when, time }); reply = `What should the ${type.toLowerCase()} task be called?`;
  } else if (/record (a )?follow/.test(low)) reply = 'Open the lead and use “Add follow-up” — I can find it for you: ask “followups due today” and tap a lead.';
  else if (/follow ?ups? (due )?today|due today/.test(low)) {
    const rows = q(`SELECT l.id,l.number,c.display_name customer,l.next_followup FROM leads l LEFT JOIN customers c ON c.id=l.customer_id WHERE l.tenant_id=? AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1 AND substr(l.next_followup,1,10)=?${sc} ORDER BY l.next_followup LIMIT 15`, t, today);
    reply = rows.length ? `${rows.length} follow-up${rows.length > 1 ? 's' : ''} due today:` : 'No follow-ups due today.'; data = { type: 'leads', rows };
  } else if (/how many leads/.test(low)) {
    const per = /week/.test(low) ? 'week' : /month/.test(low) ? 'month' : 'today';
    const from = per === 'today' ? today : per === 'week' ? ymd(new Date(Date.now() - 6 * 864e5)) : today.slice(0, 8) + '01';
    const n = one(`SELECT COUNT(*) n FROM leads l WHERE l.tenant_id=? AND substr(l.created_at,1,10)>=?${sc}`, t, from).n;
    reply = `${n} lead${n === 1 ? '' : 's'} ${per === 'today' ? 'today' : per === 'week' ? 'in the last 7 days' : 'this month'}.`;
  } else if (/who (has|have) the most delayed/.test(low)) {
    const rows = q("SELECT u.name, COUNT(*) n FROM tasks t JOIN users u ON u.id=t.host_id WHERE t.tenant_id=? AND t.status='pending' AND t.scheduled_at<? GROUP BY u.id ORDER BY n DESC LIMIT 5", t, `${today}T${new Date().toTimeString().slice(0, 5)}`);
    reply = rows.length ? `${rows[0].name} has the most delayed tasks (${rows[0].n}).` : 'Nobody has delayed tasks. 🎉'; data = { type: 'table', rows };
  } else if (/tasks? (are )?delayed|delayed tasks/.test(low)) {
    const n = one("SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND status='pending' AND scheduled_at<?", t, `${today}T${new Date().toTimeString().slice(0, 5)}`).n;
    reply = `${n} task${n === 1 ? ' is' : 's are'} delayed.`;
  } else if (/who (all )?(is|are) present|present today/.test(low)) {
    const rows = q("SELECT u.name, a.check_in FROM attendance a JOIN users u ON u.id=a.user_id WHERE a.tenant_id=? AND a.date=?", t, today);
    reply = rows.length ? `${rows.length} present today: ${rows.map((x) => x.name).join(', ')}.` : 'Nobody has checked in yet today.';
  } else reply = 'I can answer things like “How many leads today?”, “Followups due today”, “How many tasks are delayed?”, “Who has the most delayed tasks?”, “Who all are present today?”, and can “Add a new lead” or “Add task”.';
  const tokens = 120 + Math.ceil((msg.length + reply.length) / 3);
  chargeTokens(t, me.id, 'AI Assistant', msg.slice(0, 40), tokens);
  res.json({ reply, data, action, tokens });
}));

// ====================== Search (command palette) ======================
r.get('/search', ah((req, res) => {
  const t = T(req), s = `%${req.query.q || ''}%`; if (!req.query.q) return res.json({});
  const ids = visibleUsers(req.user); const sc = ids ? ` AND l.assignee_id IN (${inList(ids)})` : '';
  res.json({
    customers: q('SELECT id,display_name,phone FROM customers WHERE tenant_id=? AND (display_name LIKE ? OR phone LIKE ?) LIMIT 6', t, s, s),
    leads: q(`SELECT l.id,l.number,c.display_name customer FROM leads l JOIN customers c ON c.id=l.customer_id WHERE l.tenant_id=? AND (c.display_name LIKE ? OR c.phone LIKE ? OR CAST(l.number AS TEXT) LIKE ?)${sc} LIMIT 6`, t, s, s, s),
    tasks: q('SELECT id,title FROM tasks WHERE tenant_id=? AND title LIKE ? LIMIT 5', t, s),
    quotations: q('SELECT x.id,x.number,c.display_name customer FROM quotations x LEFT JOIN customers c ON c.id=x.customer_id WHERE x.tenant_id=? AND (x.number LIKE ? OR c.display_name LIKE ?) LIMIT 5', t, s, s),
  });
}));

// ====================== Attendance & locations ======================
r.get('/attendance/today', ah((req, res) => res.json(one('SELECT * FROM attendance WHERE tenant_id=? AND user_id=? AND date=?', T(req), req.user.id, ymd()) || null)));
r.post('/attendance/check-in', ah((req, res) => {
  if (one('SELECT 1 FROM attendance WHERE tenant_id=? AND user_id=? AND date=?', T(req), req.user.id, ymd())) return res.status(400).json({ error: 'Already checked in today' });
  run('INSERT INTO attendance(tenant_id,user_id,date,check_in) VALUES(?,?,?,?)', T(req), req.user.id, ymd(), now()); res.json({ ok: true });
}));
r.post('/attendance/check-out', ah((req, res) => { run('UPDATE attendance SET check_out=? WHERE tenant_id=? AND user_id=? AND date=? AND check_out IS NULL', now(), T(req), req.user.id, ymd()); res.json({ ok: true }); }));
r.post('/locations', ah((req, res) => {
  const { lat, lng } = req.body; if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat/lng required' });
  run('INSERT INTO user_locations(user_id,tenant_id,lat,lng,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,updated_at=excluded.updated_at', req.user.id, T(req), lat, lng, now()); res.json({ ok: true });
}));
r.get('/locations', need('user_location', 'view'), ah((req, res) => {
  const rows = q('SELECT l.*, u.name FROM user_locations l JOIN users u ON u.id=l.user_id WHERE l.tenant_id=?', T(req));
  res.json(rows.map((x) => ({ ...x, online: Date.now() - new Date(x.updated_at).getTime() < 10 * 60000 })));
}));

// ====================== Excel / CSV import ======================
const TEMPLATES = {
  individual: ['first_name', 'last_name', 'phone', 'email', 'place'],
  business: ['company', 'contact_person', 'phone', 'email', 'place'],
  enquiry: ['customer_name', 'phone', 'item', 'quantity', 'source', 'assignee_username', 'next_followup', 'business_value', 'remark'],
  items: ['name', 'code', 'price', 'category'],
  accounts: ['name', 'group', 'opening_balance'],
};
r.get('/import/template/:entity', ah((req, res) => { const h = TEMPLATES[req.params.entity] || TEMPLATES.accounts; res.json({ columns: h, csv: h.join(',') + '\n' }); }));
r.get('/import/history', ah((req, res) => res.json(q('SELECT i.*, u.name by_name FROM uploads i LEFT JOIN users u ON u.id=i.user_id WHERE i.tenant_id=? AND (?=\'\' OR i.entity=?) ORDER BY i.id DESC LIMIT 100', T(req), req.query.entity || '', req.query.entity || ''))));
r.post('/import/:entity', need('upload_management', 'add'), ah((req, res) => {
  const t = T(req), ent = req.params.entity, rows = req.body.rows || [], file = req.body.file || 'upload.csv';
  const errors = []; let ok = 0;
  const tx = db.transaction(() => {
    rows.forEach((row, i) => {
      const line = i + 2;
      try {
        if (ent === 'individual' || ent === 'business') {
          const name = ent === 'individual' ? [row.first_name, row.last_name].filter(Boolean).join(' ') : row.company;
          if (!name) throw new Error('Name is required');
          const ph = String(row.phone || '').replace(/\D/g, '');
          if (ph && (ph.length < 6 || ph.length > 15)) throw new Error('Invalid phone');
          if (ph && one('SELECT 1 FROM customers WHERE tenant_id=? AND phone=?', t, ph)) throw new Error('Duplicate phone');
          run('INSERT INTO customers(tenant_id,type,first_name,last_name,display_name,company,phone,email,place,level,owner_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', t, ent, row.first_name, row.last_name, name, row.company, ph, row.email, row.place, 'Prospect', req.user.id, now());
        } else if (ent === 'items') {
          if (!row.name) throw new Error('Item name is required');
          let cat = null; if (row.category) { cat = one("SELECT id FROM lookups WHERE tenant_id=? AND kind='category' AND name=?", t, row.category)?.id || run("INSERT INTO lookups(tenant_id,kind,name) VALUES(?,'category',?)", t, row.category).lastInsertRowid; }
          run('INSERT INTO items(tenant_id,name,code,price,category_id) VALUES(?,?,?,?,?)', t, row.name, row.code, +row.price || 0, cat);
        } else if (ent === 'enquiry') {
          const ph = String(row.phone || '').replace(/\D/g, ''); if (ph.length < 6) throw new Error('Invalid phone'); if (!row.customer_name) throw new Error('Customer name is required');
          let c = one('SELECT id FROM customers WHERE tenant_id=? AND phone=?', t, ph)?.id || run('INSERT INTO customers(tenant_id,type,display_name,phone,level,owner_id,created_at) VALUES(?,?,?,?,?,?,?)', t, 'individual', row.customer_name, ph, 'Prospect', req.user.id, now()).lastInsertRowid;
          const as = row.assignee_username ? one('SELECT id FROM users WHERE tenant_id=? AND LOWER(username)=LOWER(?)', t, row.assignee_username)?.id : req.user.id; if (!as) throw new Error('Unknown assignee');
          const src = row.source ? one('SELECT id FROM lead_sources WHERE tenant_id=? AND LOWER(name)=LOWER(?)', t, row.source)?.id : null;
          const li = run('INSERT INTO leads(tenant_id,number,customer_id,branch_id,assignee_id,source_id,nature,stage,business_value,remark,next_followup,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', t, nextNumber(t, 'leads'), c, req.user.branch_id, as, src, 'New', 'New', +row.business_value || 0, row.remark, row.next_followup || null, req.user.id, now(), now()).lastInsertRowid;
          if (row.item) run('INSERT INTO lead_items(lead_id,item_name,quantity) VALUES(?,?,?)', li, row.item, +row.quantity || 1);
        } else if (!row.name) throw new Error('Name is required');
        ok++;
      } catch (e) { errors.push({ line, error: e.message }); }
    });
  });
  tx();
  run('INSERT INTO uploads(tenant_id,entity,file,status,errors,user_id,created_at) VALUES(?,?,?,?,?,?,?)', t, ent, file, errors.length ? (ok ? 'Partly imported' : 'Failed') : 'Imported', errors.length, req.user.id, now());
  audit(req, 'Added', 'import', 0, `${ent}: ${ok} rows`);
  res.json({ imported: ok, errors });
}));

// ====================== What's new ======================
r.get('/whats-new', ah((_req, res) => res.json({
  version: '1.0.0', date: '2026-11-17', stats: { features: 58, fixes: 0 },
  sections: [
    { module: 'CRM', items: ['New Enquiry form in numbered sections with sticky Save/Cancel', 'Leads list with filter chips, bulk bar, nature/status views and kanban', 'Follow-up agenda with week strip, missed and non-follow-up lists', 'Lead transfer, create-from-existing and bulk lost', 'Quotations with discounts, payment terms, board and table views', 'Sales targets with spread helper, lead expenses and source commission with TDS'] },
    { module: 'Task Management', items: ['Weekly board with drag-to-schedule', 'Instant, later and repeat tasks with live timer, hold and end', 'Predefined tasks with serial copies', 'Team week calendar, timeline, to-do list and daily activity'] },
    { module: 'Dashboards & Reports', items: ['CRM dashboard with Overview, Needs attention, Pipeline, Team, Sources & ROI, Items and Calls tabs', 'Executive performance score and lead forecast', '18 built-in reports with CSV export and a custom report builder'] },
    { module: 'Platform', items: ['Multi-tenant company codes, branches, levels, roles with 54 permissions', 'SLA escalation and auto-reassign', 'Automation templates with history', 'Team chat, mail, AI assistant and AI call analysis with token wallet', 'Command palette (Ctrl+K), quick links, dark mode, English / Arabic'] },
  ],
})));

export default r;
