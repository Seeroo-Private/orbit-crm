import { ah, need, can, crud, newRouter, notify, nextNumber, visibleUsers, inList, q, one, run, now, audit, db } from '../core.js';
import { settingsOf } from './masters.js';
import { LEAD_SELECT, periodRange, rangeSql, fire, ymd, chargeTokens } from '../lib.js';

const r = newRouter();
const T = (req) => req.user.tenant_id;

// ======================= Customers =======================
const custRow = (c) => ({ ...c, custom: safe(c.custom) });
const safe = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

r.get('/customers', need('customers', 'view'), ah((req, res) => {
  const t = T(req), p = [t];
  let where = 'c.tenant_id=?';
  const s = settingsOf(t).enquiry;
  if (s.search_own_customers && !req.user.is_owner && !can(req.user, 'customers', 'view_all')) {
    const ids = visibleUsers(req.user) || [req.user.id];
    where += ` AND (c.owner_id IN (${inList(ids)}) OR c.owner_id IS NULL)`;
  }
  if (req.query.level) { where += ' AND c.level=?'; p.push(req.query.level); }
  if (req.query.q) {
    const f = req.query.field, like = `%${req.query.q}%`;
    if (f === 'phone') { where += ' AND (c.phone LIKE ? OR (c.country_code||c.phone) LIKE ?)'; p.push(like, like); }
    else if (f === 'email') { where += ' AND c.email LIKE ?'; p.push(like); }
    else if (f === 'name') { where += ' AND c.display_name LIKE ?'; p.push(like); }
    else { where += ' AND (c.display_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.place LIKE ?)'; p.push(like, like, like, like); }
  }
  const order = { name_desc: 'c.display_name DESC', recent: 'c.id DESC' }[req.query.sort] || 'c.display_name COLLATE NOCASE';
  const rows = q(`SELECT c.*, (SELECT COUNT(*) FROM leads l WHERE l.customer_id=c.id) enquiries, (SELECT COUNT(*) FROM quotations x WHERE x.customer_id=c.id) quotations, u.name owner
    FROM customers c LEFT JOIN users u ON u.id=c.owner_id WHERE ${where} ORDER BY ${order} LIMIT 500`, ...p);
  const counts = q('SELECT level, COUNT(*) n FROM customers WHERE tenant_id=? GROUP BY level', t);
  res.json({ rows: rows.map(custRow), counts: Object.fromEntries(counts.map((x) => [x.level, x.n])), total: counts.reduce((a, b) => a + b.n, 0) });
}));
// phone lookup used by the enquiry/task party picker
r.get('/customers/lookup', ah((req, res) => {
  const t = T(req), term = (req.query.q || '').trim();
  if (!term) return res.json([]);
  const digits = term.replace(/\D/g, '');
  const rows = q(`SELECT id,display_name,phone,country_code,email,place,level,type FROM customers WHERE tenant_id=? AND (display_name LIKE ? OR phone LIKE ? OR (country_code||phone) LIKE ?) ORDER BY display_name LIMIT 20`,
    t, `%${term}%`, `%${digits || term}%`, `%${digits || term}%`);
  res.json(rows);
}));
r.post('/customers', need('customers', 'add'), ah((req, res) => {
  const b = req.body, t = T(req);
  const display = b.display_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || b.company;
  if (!display) return res.status(400).json({ error: 'Name is required' });
  if (b.phone) {
    const clean = String(b.phone).replace(/\D/g, '');
    if (clean.length < 6 || clean.length > 15) return res.status(400).json({ error: 'Phone number must be 6–15 digits' });
    if (one('SELECT 1 FROM customers WHERE tenant_id=? AND phone=? AND country_code=?', t, clean, b.country_code || '+91')) return res.status(400).json({ error: 'A customer with this phone number already exists' });
    b.phone = clean;
  }
  const i = run(`INSERT INTO customers(tenant_id,type,first_name,last_name,display_name,company,phone,country_code,secondary_phone,email,place,currency,level,owner_id,custom,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    t, b.type || 'individual', b.first_name, b.last_name, display, b.company, b.phone, b.country_code || '+91', b.secondary_phone, b.email, b.place, b.currency || 'INR', b.level || 'Customer', req.user.id, JSON.stringify(b.custom || {}), now());
  audit(req, 'Added', 'customer', i.lastInsertRowid, display);
  res.json(custRow(one('SELECT * FROM customers WHERE id=?', i.lastInsertRowid)));
}));
r.get('/customers/:id', need('customers', 'view'), ah((req, res) => {
  const t = T(req);
  const c = one('SELECT c.*, u.name owner FROM customers c LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=? AND c.tenant_id=?', req.params.id, t);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const leads = q(`${LEAD_SELECT} WHERE l.customer_id=? ORDER BY l.id DESC`, c.id);
  const quotations = q('SELECT * FROM quotations WHERE customer_id=? ORDER BY id DESC', c.id);
  const tasks = q('SELECT id,title,type,status,scheduled_at FROM tasks WHERE party_id=? ORDER BY id DESC', c.id);
  const timeline = [
    ...leads.map((l) => ({ at: l.created_at, kind: 'Enquiry', text: `Enquiry #${l.number} created${l.items ? ` for ${l.items}` : ''}` })),
    ...q('SELECT f.*, l.number FROM followups f JOIN leads l ON l.id=f.lead_id WHERE l.customer_id=?', c.id).map((f) => ({ at: f.created_at, kind: 'Follow-up', text: `Follow-up on #${f.number}: ${f.description || '—'}` })),
    ...quotations.map((x) => ({ at: x.created_at, kind: 'Quotation', text: `Quotation ${x.number} · ₹${x.total}` })),
    ...tasks.map((x) => ({ at: x.scheduled_at, kind: 'Task', text: `${x.type}: ${x.title} (${x.status})` })),
  ].filter((e) => e.at).sort((a, b) => (a.at < b.at ? 1 : -1));
  res.json({ ...custRow(c), contacts: q('SELECT * FROM customer_contacts WHERE customer_id=?', c.id), addresses: q('SELECT * FROM customer_addresses WHERE customer_id=?', c.id), leads, quotations, tasks, timeline });
}));
r.put('/customers/:id', need('customers', 'edit'), ah((req, res) => {
  const b = req.body, t = T(req);
  const cur = one('SELECT * FROM customers WHERE id=? AND tenant_id=?', req.params.id, t);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const display = b.display_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || cur.display_name;
  const phone = b.phone ? String(b.phone).replace(/\D/g, '') : cur.phone;
  if (phone !== cur.phone && one('SELECT 1 FROM customers WHERE tenant_id=? AND phone=? AND country_code=? AND id<>?', t, phone, b.country_code || cur.country_code, cur.id)) return res.status(400).json({ error: 'Phone number already used by another customer' });
  run(`UPDATE customers SET type=?,first_name=?,last_name=?,display_name=?,company=?,phone=?,country_code=?,secondary_phone=?,email=?,place=?,currency=?,level=?,custom=? WHERE id=?`,
    b.type ?? cur.type, b.first_name ?? cur.first_name, b.last_name ?? cur.last_name, display, b.company ?? cur.company, phone, b.country_code ?? cur.country_code, b.secondary_phone ?? cur.secondary_phone, b.email ?? cur.email, b.place ?? cur.place, b.currency ?? cur.currency, b.level ?? cur.level, JSON.stringify(b.custom ?? safe(cur.custom)), cur.id);
  audit(req, 'Edited', 'customer', cur.id, display);
  res.json({ ok: true });
}));
r.delete('/customers/:id', need('customers', 'delete'), ah((req, res) => {
  if (one('SELECT 1 FROM leads WHERE customer_id=?', req.params.id)) return res.status(400).json({ error: 'Customer has enquiries and cannot be deleted. Block the number instead.' });
  run('DELETE FROM customers WHERE id=? AND tenant_id=?', req.params.id, T(req));
  audit(req, 'Deleted', 'customer', +req.params.id, '');
  res.json({ ok: true });
}));
r.post('/customers/:id/block', need('customers', 'edit'), ah((req, res) => {
  run('UPDATE customers SET blocked=? WHERE id=? AND tenant_id=?', +!!req.body.blocked, req.params.id, T(req)); res.json({ ok: true });
}));
for (const [path, table, cols] of [['contacts', 'customer_contacts', ['name', 'phone', 'email', 'designation']], ['addresses', 'customer_addresses', ['line1', 'city', 'state', 'pincode']]]) {
  r.post(`/customers/:id/${path}`, need('customers', 'edit'), ah((req, res) => {
    run(`INSERT INTO ${table}(tenant_id,customer_id,${cols.join(',')}) VALUES(?,?,${cols.map(() => '?').join(',')})`, T(req), req.params.id, ...cols.map((c) => req.body[c]));
    res.json({ ok: true });
  }));
  r.delete(`/customers/:id/${path}/:rid`, need('customers', 'edit'), ah((req, res) => { run(`DELETE FROM ${table} WHERE id=? AND customer_id=?`, req.params.rid, req.params.id); res.json({ ok: true }); }));
}
// Change requests (name / phone / email) that need approval
r.post('/customers/:id/request-change', ah((req, res) => {
  const { field, value } = req.body;
  if (!['display_name', 'phone', 'email'].includes(field)) return res.status(400).json({ error: 'Field cannot be changed by request' });
  const c = one('SELECT * FROM customers WHERE id=? AND tenant_id=?', req.params.id, T(req));
  run('INSERT INTO customer_changes(tenant_id,customer_id,field,old_value,new_value,requested_by,created_at) VALUES(?,?,?,?,?,?,?)', T(req), c.id, field, c[field], value, req.user.id, now());
  res.json({ ok: true });
}));
r.get('/customer-changes', need('customers', 'edit'), ah((req, res) => res.json(q(`SELECT x.*, c.display_name customer, u.name requester FROM customer_changes x JOIN customers c ON c.id=x.customer_id LEFT JOIN users u ON u.id=x.requested_by WHERE x.tenant_id=? AND x.status='pending' ORDER BY x.id DESC`, T(req)))));
r.post('/customer-changes/:id/:decision', need('customers', 'edit'), ah((req, res) => {
  const ch = one('SELECT * FROM customer_changes WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!ch) return res.status(404).json({ error: 'Not found' });
  if (req.params.decision === 'approve') run(`UPDATE customers SET ${ch.field}=? WHERE id=?`, ch.new_value, ch.customer_id);
  run('UPDATE customer_changes SET status=? WHERE id=?', req.params.decision === 'approve' ? 'approved' : 'rejected', ch.id);
  res.json({ ok: true });
}));

// ======================= Leads =======================
function leadScope(req, p) {
  const ids = visibleUsers(req.user);
  if (!ids) return '';
  p.push(req.user.id);
  return ` AND (l.assignee_id IN (${inList(ids)}) OR l.created_by=?)`;
}
export function buildLeadFilter(req, p) {
  const f = req.query;
  let w = ' WHERE l.tenant_id=?'; p.push(T(req));
  w += leadScope(req, p);
  if (f.tab === 'new') w += " AND l.nature='New'";
  else if (f.tab === 'followup') w += " AND l.nature NOT IN ('New','Won','Lost')";
  else if (f.tab === 'won') w += " AND l.nature='Won'";
  else if (f.tab === 'lost') w += " AND l.nature='Lost'";
  else if (f.tab === 'open') w += " AND l.nature NOT IN ('Won','Lost')";
  if (f.q) { w += ' AND (c.display_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR CAST(l.number AS TEXT)=?)'; p.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`, f.q); }
  for (const [k, col] of [['status', 'l.status_id'], ['source', 'l.source_id'], ['assignee', 'l.assignee_id'], ['quality', 'l.quality'], ['nature', 'l.nature'], ['branch', 'l.branch_id'], ['stage', 'l.stage'], ['type', 'l.type'], ['customer', 'l.customer_id']]) {
    if (f[k]) { w += ` AND ${col}=?`; p.push(f[k]); }
  }
  if (f.item) { w += ' AND EXISTS(SELECT 1 FROM lead_items li WHERE li.lead_id=l.id AND li.item_id=?)'; p.push(f.item); }
  w += rangeSql('l.created_at', periodRange(f.period, f.from, f.to), p);
  if (f.next_from) { w += ' AND substr(l.next_followup,1,10)>=?'; p.push(f.next_from); }
  if (f.next_to) { w += ' AND substr(l.next_followup,1,10)<=?'; p.push(f.next_to); }
  if (f.missed) { w += " AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1 AND l.next_followup IS NOT NULL AND l.next_followup < ?"; p.push(ymd() + 'T00:00'); }
  if (f.nonfollowup) w += " AND l.nature NOT IN ('Won','Lost') AND l.followup_required=0";
  if (f.pending_payment) w += " AND l.nature='Won' AND l.collected < l.business_value";
  return w;
}
r.get('/leads', need('lead_management', 'view'), ah((req, res) => {
  const p = [], w = buildLeadFilter(req, p);
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(+req.query.limit || 25, 2000);
  const order = { oldest: 'l.id ASC', value: 'l.business_value DESC', followup: 'l.next_followup ASC' }[req.query.sort] || 'l.created_at DESC, l.id DESC';
  const total = one(`SELECT COUNT(*) n FROM leads l LEFT JOIN customers c ON c.id=l.customer_id ${w}`, ...p).n;
  const rows = q(`${LEAD_SELECT} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, limit, (page - 1) * limit);
  // tab counts ignore tab filter
  const cp = [], base = { ...req, query: { ...req.query, tab: undefined, page: undefined } };
  const cw = buildLeadFilter(base, cp);
  const counts = q(`SELECT l.nature n, COUNT(*) c FROM leads l LEFT JOIN customers c ON c.id=l.customer_id ${cw} GROUP BY l.nature`, ...cp);
  const m = Object.fromEntries(counts.map((x) => [x.n, x.c]));
  const all = counts.reduce((a, b) => a + b.c, 0);
  res.json({ rows: rows.map((x) => ({ ...x, custom: safe(x.custom) })), total, page, limit, counts: { new: m.New || 0, followup: all - (m.New || 0) - (m.Won || 0) - (m.Lost || 0), won: m.Won || 0, lost: m.Lost || 0, all } });
}));

// Agenda: counts for each day of a week + missed + non-followup
r.get('/followups/agenda', need('lead_management', 'view'), ah((req, res) => {
  const start = req.query.start || ymd(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start + 'T00:00'); d.setDate(d.getDate() + i);
    const p = []; const base = { ...req, query: { next_from: ymd(d), next_to: ymd(d), tab: 'open' } };
    const w = buildLeadFilter(base, p);
    days.push({ date: ymd(d), count: one(`SELECT COUNT(*) n FROM leads l ${w} AND l.followup_required=1`, ...p).n });
  }
  const p1 = []; const mw = buildLeadFilter({ ...req, query: { missed: 1 } }, p1);
  const p2 = []; const nw = buildLeadFilter({ ...req, query: { nonfollowup: 1 } }, p2);
  res.json({ days, missed: one(`SELECT COUNT(*) n FROM leads l ${mw}`, ...p1).n, nonfollowup: one(`SELECT COUNT(*) n FROM leads l ${nw}`, ...p2).n });
}));

function applyItems(leadId, items = []) {
  run('DELETE FROM lead_items WHERE lead_id=?', leadId);
  for (const it of items) {
    if (!it.item_id && !it.item_name) continue;
    const nm = it.item_name || one('SELECT name FROM items WHERE id=?', it.item_id)?.name;
    run('INSERT INTO lead_items(lead_id,item_id,item_name,quantity,note) VALUES(?,?,?,?,?)', leadId, it.item_id || null, nm, it.quantity || 1, it.note || '');
  }
}
function pickAssignee(req, s, branchId) {
  const t = T(req);
  const pool = q(`SELECT u.id FROM users u WHERE u.tenant_id=? AND u.active=1 AND u.is_online=1 ${branchId ? 'AND (u.branch_id=? OR u.branch_id IS NULL)' : ''} ORDER BY u.id`, ...(branchId ? [t, branchId] : [t]));
  if (!pool.length) return req.user.id;
  const last = one('SELECT assignee_id FROM leads WHERE tenant_id=? AND assignee_id IS NOT NULL ORDER BY id DESC LIMIT 1', t)?.assignee_id;
  const idx = pool.findIndex((u) => u.id === last);
  return pool[(idx + 1) % pool.length].id;
}

r.post('/leads', need('lead_management', 'add'), ah((req, res) => {
  const t = T(req), b = req.body, s = settingsOf(t).enquiry;
  // --- validate by tenant settings
  const errs = [];
  if (s.need_source && s.require_source && !b.source_id) errs.push('Lead source is required');
  if (s.need_remark && s.require_remark && !b.remark) errs.push('Remark is required');
  if (s.need_place && s.require_place && !b.place && !b.new_customer?.place) errs.push('Place is required');
  if (s.need_business_value && s.require_business_value && !b.business_value) errs.push('Business value is required');
  if (s.need_lead_quality && s.require_lead_quality && !b.quality) errs.push('Lead quality is required');
  if (s.need_quantity && s.require_quantity && !(b.items || []).some((i) => +i.quantity > 0)) errs.push('Quantity is required');
  if (s.need_item_description && s.require_item_description && !(b.items || []).some((i) => i.note)) errs.push('Item description is required');
  // --- customer
  let cid = b.customer_id;
  if (!cid && b.new_customer) {
    const nc = b.new_customer;
    if (!nc.name) errs.push('Customer name is required');
    const clean = String(nc.phone || '').replace(/\D/g, '');
    if (clean.length < 6 || clean.length > 15) errs.push('Customer phone must be 6–15 digits');
    if (errs.length) return res.status(400).json({ error: errs.join('. ') });
    const ex = one('SELECT id FROM customers WHERE tenant_id=? AND phone=? AND country_code=?', t, clean, nc.country_code || '+91');
    if (ex) cid = ex.id;
    else {
      cid = run('INSERT INTO customers(tenant_id,type,display_name,first_name,phone,country_code,place,level,owner_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', t, nc.type || (s.default_customer_type === 'Business' ? 'business' : 'individual'), nc.name, nc.name, clean, nc.country_code || '+91', nc.place, 'Prospect', req.user.id, now()).lastInsertRowid;
    }
  }
  if (!cid) errs.push('Choose or add a customer');
  if (errs.length) return res.status(400).json({ error: errs.join('. ') });
  const cust = one('SELECT * FROM customers WHERE id=?', cid);
  if (cust.blocked) return res.status(400).json({ error: 'This customer number is blocked' });
  if (s.prevent_active_followup && one("SELECT 1 FROM leads WHERE customer_id=? AND nature NOT IN ('Won','Lost')", cid)) return res.status(400).json({ error: 'This customer already has an open follow-up' });
  // --- assignment
  let assignee = b.assignee_id;
  if (s.assign_auto && !assignee) assignee = pickAssignee(req, s, b.branch_id);
  if (!assignee) return res.status(400).json({ error: 'Assign To is required' });
  const branch = b.branch_id || req.user.branch_id || one('SELECT id FROM branches WHERE tenant_id=? LIMIT 1', t)?.id;
  const required = b.followup_required === false || b.followup_required === 0 ? 0 : 1;
  const num = nextNumber(t, 'leads');
  const info = run(`INSERT INTO leads(tenant_id,number,type,customer_id,branch_id,assignee_id,status_id,stage,quality,nature,business_value,source_id,dealer,remark,place,next_followup,followup_required,created_by,custom,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  t, num, b.type || 'enquiry', cid, branch, assignee, b.status_id || null, 'New', b.quality || null, 'New', +b.business_value || 0, b.source_id || null, b.dealer, b.remark, b.place || cust.place, required ? b.next_followup || null : null, required, req.user.id, JSON.stringify(b.custom || {}), b.date ? `${b.date}T${new Date().toTimeString().slice(0, 8)}` : now(), now());
  const id = info.lastInsertRowid;
  applyItems(id, b.items);
  if (cust.level === 'Suspect') run("UPDATE customers SET level='Prospect' WHERE id=?", cid);
  // default task
  if (s.default_task && s.default_task !== 'None') {
    const typeMap = { 'Offline Meeting': 'Offline Meeting', 'Online Meeting': 'Online Meeting', Activity: 'Activities' };
    const ti = run(`INSERT INTO tasks(tenant_id,type,priority,title,mode,status,scheduled_at,host_id,party_id,lead_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      t, typeMap[s.default_task] || 'Activities', 'Normal', `${s.default_task}: ${cust.display_name}`, 'later', 'pending', required ? b.next_followup || null : null, assignee, cid, id, req.user.id, now());
    run('INSERT INTO task_participants VALUES(?,?,?)', ti.lastInsertRowid, assignee, 'Host');
  }
  const lead = one('SELECT * FROM leads WHERE id=?', id);
  fire(t, 'New Enquiry', lead);
  if (assignee !== req.user.id) notify(t, assignee, 'New lead assigned', `Enquiry #${num} · ${cust.display_name}`, `/leads/${id}`, 'lead');
  audit(req, 'Added', 'lead', id, `Enquiry #${num}`);
  res.json({ id, number: num });
}));

r.get('/leads/:id', need('lead_management', 'view'), ah((req, res) => {
  const t = T(req);
  const l = one(`${LEAD_SELECT} WHERE l.id=? AND l.tenant_id=?`, req.params.id, t);
  if (!l) return res.status(404).json({ error: 'Not found' });
  const ids = visibleUsers(req.user);
  if (ids && !ids.includes(l.assignee_id) && l.created_by !== req.user.id) return res.status(403).json({ error: 'This lead is not in your scope' });
  res.json({
    ...l, custom: safe(l.custom),
    customer: one('SELECT * FROM customers WHERE id=?', l.customer_id),
    line_items: q('SELECT * FROM lead_items WHERE lead_id=?', l.id),
    followups: q('SELECT f.*, s.name status, u.name user FROM followups f LEFT JOIN lead_statuses s ON s.id=f.status_id LEFT JOIN users u ON u.id=f.user_id WHERE f.lead_id=? ORDER BY f.id DESC', l.id),
    quotations: q('SELECT * FROM quotations WHERE lead_id=? ORDER BY id DESC', l.id),
    tasks: q('SELECT t.*, u.name host FROM tasks t LEFT JOIN users u ON u.id=t.host_id WHERE t.lead_id=? ORDER BY t.id DESC', l.id),
    transfers: q('SELECT x.*, a.name from_name, b.name to_name FROM lead_transfers x LEFT JOIN users a ON a.id=x.from_user LEFT JOIN users b ON b.id=x.to_user WHERE x.lead_id=? ORDER BY x.id DESC', l.id),
    calls: q('SELECT * FROM call_analyses WHERE lead_id=? ORDER BY id DESC', l.id),
    automations: q('SELECT g.*, a.trigger_on FROM automation_logs g LEFT JOIN automations a ON a.id=g.automation_id WHERE g.lead_id=? ORDER BY g.id DESC', l.id),
  });
}));
r.put('/leads/:id', need('lead_management', 'edit'), ah((req, res) => {
  const b = req.body, id = req.params.id;
  const cur = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', id, T(req));
  if (!cur) return res.status(404).json({ error: 'Not found' });
  run(`UPDATE leads SET source_id=?,dealer=?,remark=?,place=?,business_value=?,quality=?,branch_id=?,custom=?,updated_at=? WHERE id=?`,
    b.source_id ?? cur.source_id, b.dealer ?? cur.dealer, b.remark ?? cur.remark, b.place ?? cur.place, b.business_value ?? cur.business_value, b.quality ?? cur.quality, b.branch_id ?? cur.branch_id, JSON.stringify(b.custom ?? safe(cur.custom)), now(), id);
  if (b.items) applyItems(id, b.items);
  audit(req, 'Edited', 'lead', +id, `Enquiry #${cur.number}`);
  res.json({ ok: true });
}));
r.delete('/leads/:id', need('lead_management', 'delete'), ah((req, res) => {
  const l = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!l) return res.status(404).json({ error: 'Not found' });
  for (const tb of ['lead_items', 'followups']) run(`DELETE FROM ${tb} WHERE lead_id=?`, l.id);
  run('DELETE FROM leads WHERE id=?', l.id);
  audit(req, 'Deleted', 'lead', l.id, `Enquiry #${l.number}`);
  res.json({ ok: true });
}));

// Kanban drag-and-drop: move an open lead to another pipeline stage or quality column.
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Nurture'];
const OPEN_QUALITIES = ['Warm', 'Hot', 'Super Hot'];
r.post('/leads/:id/move', need('lead_management', 'edit'), ah((req, res) => {
  const lead = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (['Won', 'Lost'].includes(lead.nature)) return res.status(400).json({ error: 'Closed leads cannot be moved. Add a follow-up to reopen.' });
  const { stage, quality } = req.body;
  if (stage !== undefined && !STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage' });
  if (quality !== undefined && !OPEN_QUALITIES.includes(quality)) return res.status(400).json({ error: 'Unknown quality' });
  const nq = quality ?? lead.quality;
  const ns = stage ?? (quality && lead.stage === 'New' ? 'Contacted' : lead.stage);
  const nature = quality ? natureFor(null, nq) : lead.nature;
  run('UPDATE leads SET stage=?,quality=?,nature=?,updated_at=? WHERE id=?', ns, nq, nature, now(), lead.id);
  audit(req, 'Moved', 'lead', lead.id, `Enquiry #${lead.number} → ${stage || quality}`);
  res.json({ ok: true, stage: ns, quality: nq, nature });
}));

function natureFor(status, quality) {
  if (status?.nature === 'won') return 'Won';
  if (status?.nature === 'lost') return 'Lost';
  if (quality === 'Super Hot') return 'Super Hot';
  if (quality === 'Hot') return 'Hot';
  return 'Warm';
}
function addFollowup(req, lead, b) {
  const t = T(req), s = settingsOf(t).enquiry;
  const status = b.status_id ? one('SELECT * FROM lead_statuses WHERE id=? AND tenant_id=?', b.status_id, t) : null;
  if (s.require_followup_remark && !b.description) throw Object.assign(new Error('Follow-up description is required'), { status: 400 });
  if (s.need_lead_quality && !b.quality && !lead.quality && status?.nature === 'followup') throw Object.assign(new Error('Lead quality is required for a follow-up'), { status: 400 });
  const quality = b.quality || lead.quality;
  const nature = natureFor(status, quality);
  const open = nature !== 'Won' && nature !== 'Lost';
  const required = open && b.followup_required !== false ? 1 : 0;
  const bv = b.business_value !== undefined && b.business_value !== '' && b.business_value !== null ? +b.business_value : lead.business_value;
  run('INSERT INTO followups(tenant_id,lead_id,status_id,quality,stage,description,next_followup,business_value,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', t, lead.id, status?.id || null, quality, b.stage || lead.stage, b.description, required ? b.next_followup || null : null, bv, req.user.id, now());
  run(`UPDATE leads SET status_id=?,quality=?,stage=?,nature=?,business_value=?,next_followup=?,followup_required=?,first_response_at=COALESCE(first_response_at,?),lost_reason=?,won_at=?,updated_at=? WHERE id=?`,
    status?.id || lead.status_id, quality, b.stage || (nature === 'Won' ? 'Won' : nature === 'Lost' ? 'Lost' : lead.stage === 'New' ? 'Contacted' : lead.stage), nature, bv, required ? b.next_followup || null : null, required, now(), nature === 'Lost' ? status?.name : null, nature === 'Won' ? now() : null, now(), lead.id);
  if (nature === 'Won') run("UPDATE customers SET level='Customer' WHERE id=?", lead.customer_id);
  const fresh = one('SELECT * FROM leads WHERE id=?', lead.id);
  fire(t, nature === 'Won' ? 'Lead Won' : nature === 'Lost' ? 'Lead Lost' : 'Followup Added', fresh);
  audit(req, 'Added', 'followup', lead.id, `Enquiry #${lead.number}`);
}
r.post('/leads/:id/followup', need('lead_management', 'edit'), ah((req, res) => {
  const lead = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  addFollowup(req, lead, req.body);
  res.json({ ok: true });
}));
r.post('/leads/:id/collect', need('lead_management', 'edit'), ah((req, res) => {
  const lead = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', req.params.id, T(req));
  run('UPDATE leads SET collected=collected+? WHERE id=?', +req.body.amount || 0, lead.id);
  audit(req, 'Edited', 'lead payment', lead.id, `Enquiry #${lead.number}`);
  res.json({ ok: true });
}));
r.post('/leads/:id/transfer', need('lead_transfer', 'add'), ah((req, res) => {
  const lead = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', req.params.id, T(req));
  doTransfer(req, [lead.id], req.body.to_user, req.body.branch_id);
  res.json({ ok: true });
}));
function doTransfer(req, ids, to, branchId) {
  const t = T(req);
  for (const id of ids) {
    const l = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', id, t);
    if (!l) continue;
    run('INSERT INTO lead_transfers(tenant_id,lead_id,from_user,to_user,status,requested_by,created_at) VALUES(?,?,?,?,?,?,?)', t, id, l.assignee_id, to, 'done', req.user.id, now());
    run('UPDATE leads SET assignee_id=?, branch_id=COALESCE(?,branch_id), updated_at=? WHERE id=?', to, branchId || null, now(), id);
    notify(t, to, 'Lead transferred to you', `Enquiry #${l.number}`, `/leads/${id}`, 'lead');
  }
}
r.post('/leads/bulk', ah((req, res) => {
  const { ids = [], action } = req.body, t = T(req);
  if (!ids.length) return res.status(400).json({ error: 'Select at least one lead' });
  if (action === 'transfer') {
    if (!can(req.user, 'lead_transfer', 'add')) return res.status(403).json({ error: 'Not allowed' });
    doTransfer(req, ids, req.body.to_user, req.body.branch_id);
  } else if (action === 'lost') {
    const st = one("SELECT * FROM lead_statuses WHERE tenant_id=? AND nature='lost' AND (id=? OR ?) ORDER BY id LIMIT 1", t, req.body.status_id || 0, req.body.status_id ? 0 : 1);
    for (const id of ids) { const l = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', id, t); if (l && l.nature !== 'Lost') addFollowup(req, l, { status_id: st?.id, description: req.body.reason || 'Bulk marked as lost' }); }
  } else if (action === 'assign_task') {
    const b = req.body;
    for (const id of ids) {
      const l = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', id, t); if (!l) continue;
      const ti = run('INSERT INTO tasks(tenant_id,type,priority,title,description,mode,status,scheduled_at,host_id,party_id,lead_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', t, b.type || 'Call', b.priority || 'Normal', b.title || 'Follow up', b.description, 'later', 'pending', b.scheduled_at || null, b.host_id || l.assignee_id, l.customer_id, l.id, req.user.id, now());
      run('INSERT OR IGNORE INTO task_participants VALUES(?,?,?)', ti.lastInsertRowid, b.host_id || l.assignee_id, 'Host');
    }
  } else if (action === 'create_from_existing') {
    const assignees = req.body.assignees?.length ? req.body.assignees : [req.user.id];
    let i = 0, made = 0;
    for (const id of ids) {
      const old = one('SELECT * FROM leads WHERE id=? AND tenant_id=?', id, t); if (!old) continue;
      const num = nextNumber(t, 'leads');
      const nid = run('INSERT INTO leads(tenant_id,number,customer_id,branch_id,assignee_id,source_id,place,nature,stage,created_by,created_at,updated_at,next_followup) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', t, num, old.customer_id, old.branch_id, assignees[i++ % assignees.length], one("SELECT id FROM lead_sources WHERE tenant_id=? AND name='Existing Customer'", t)?.id || old.source_id, old.place, 'New', 'New', req.user.id, now(), now(), ymd(new Date(Date.now() + 864e5)) + 'T10:00').lastInsertRowid;
      for (const li of q('SELECT * FROM lead_items WHERE lead_id=?', id)) run('INSERT INTO lead_items(lead_id,item_id,item_name,quantity,note) VALUES(?,?,?,?,?)', nid, li.item_id, li.item_name, li.quantity, li.note);
      made++;
    }
    return res.json({ ok: true, created: made });
  } else return res.status(400).json({ error: 'Unknown action' });
  res.json({ ok: true });
}));

// Lead transfer / SLA sweep: escalates breaches (called by the UI and on a timer)
export function slaSweep(t) {
  const s = settingsOf(t).enquiry;
  if (!s.sla_minutes) return 0;
  const cutoff = new Date(Date.now() - s.sla_minutes * 60000).toISOString();
  const rows = q("SELECT * FROM leads WHERE tenant_id=? AND first_response_at IS NULL AND sla_breached=0 AND nature='New' AND created_at<?", t, cutoff);
  for (const l of rows) {
    if (s.sla_sources?.length && !s.sla_sources.includes(l.source_id)) continue;
    run('UPDATE leads SET sla_breached=1 WHERE id=?', l.id);
    const a = one('SELECT reports_to FROM users WHERE id=?', l.assignee_id);
    notify(t, l.assignee_id, 'SLA breached', `Enquiry #${l.number} has had no follow-up`, `/leads/${l.id}`, 'sla');
    if (a?.reports_to) notify(t, a.reports_to, 'SLA breached on your team', `Enquiry #${l.number}`, `/leads/${l.id}`, 'sla');
    if (s.auto_reassign_sla) {
      const pool = q('SELECT id FROM users WHERE tenant_id=? AND active=1 AND is_online=1 AND id<>? ORDER BY id', t, l.assignee_id);
      if (pool.length) { const to = pool[l.id % pool.length].id; run('INSERT INTO lead_transfers(tenant_id,lead_id,from_user,to_user,status,created_at) VALUES(?,?,?,?,?,?)', t, l.id, l.assignee_id, to, 'auto', now()); run('UPDATE leads SET assignee_id=?,sla_breached=0,created_at=? WHERE id=?', to, now(), l.id); notify(t, to, 'Lead auto-assigned', `Enquiry #${l.number}`, `/leads/${l.id}`, 'lead'); }
    }
  }
  return rows.length;
}
r.post('/sla/sweep', ah((req, res) => res.json({ breached: slaSweep(T(req)) })));

// ======================= Quotations =======================
function saveQuotation(req, id) {
  const t = T(req), b = req.body, tpl = settingsOf(t).quotation;
  const items = (b.items || []).filter((i) => i.name || i.item_id);
  const gross = items.reduce((a, i) => a + (+i.rate || 0) * (+i.qty || 1), 0);
  const disc = b.discount_pct ? gross * (+b.discount_pct / 100) : +b.discount_amt || 0;
  const total = Math.max(0, gross - disc);
  let leadId = b.lead_id;
  if (!leadId) {
    const num = nextNumber(t, 'leads');
    leadId = run(`INSERT INTO leads(tenant_id,number,type,customer_id,branch_id,assignee_id,source_id,nature,stage,business_value,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, t, num, 'quotation', b.customer_id, req.user.branch_id, b.executive_id || req.user.id, b.source_id || null, 'New', 'Proposal Sent', total, req.user.id, now(), now()).lastInsertRowid;
  } else run("UPDATE leads SET business_value=?, stage=CASE WHEN stage IN ('New','Contacted','Qualified') THEN 'Proposal Sent' ELSE stage END WHERE id=? AND nature NOT IN ('Won','Lost')", total, leadId);
  if (id) {
    run(`UPDATE quotations SET customer_id=?,executive_id=?,source_id=?,currency=?,date=?,valid_upto=?,next_followup=?,description=?,subject=?,customer_note=?,terms=?,payment_term_id=?,discount_pct=?,discount_amt=?,gross=?,total=?,status=? WHERE id=? AND tenant_id=?`,
      b.customer_id, b.executive_id, b.source_id, b.currency || 'INR', b.date, b.valid_upto, b.next_followup, b.description, b.subject, b.customer_note, b.terms, b.payment_term_id || null, +b.discount_pct || 0, +b.discount_amt || 0, gross, total, b.status || 'Draft', id, t);
    run('DELETE FROM quotation_items WHERE quotation_id=?', id);
  } else {
    const num = `Q-${String(nextNumber(t, 'quotations', 'id')).padStart(4, '0')}`;
    id = run(`INSERT INTO quotations(tenant_id,number,lead_id,customer_id,executive_id,source_id,currency,date,valid_upto,next_followup,description,subject,customer_note,terms,payment_term_id,discount_pct,discount_amt,gross,total,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      t, num, leadId, b.customer_id, b.executive_id || req.user.id, b.source_id || null, b.currency || 'INR', b.date || ymd(), b.valid_upto, b.next_followup, b.description, b.subject, b.customer_note, b.terms ?? tpl.terms, b.payment_term_id || null, +b.discount_pct || 0, +b.discount_amt || 0, gross, total, b.status || 'Draft', now()).lastInsertRowid;
  }
  for (const i of items) run('INSERT INTO quotation_items(quotation_id,item_id,name,rate,qty,note) VALUES(?,?,?,?,?,?)', id, i.item_id || null, i.name || one('SELECT name FROM items WHERE id=?', i.item_id)?.name, +i.rate || 0, +i.qty || 1, i.note || '');
  return id;
}
const QSEL = `SELECT x.*, c.display_name customer, c.phone, c.email customer_email, u.name executive, l.number lead_number, p.name payment_term FROM quotations x LEFT JOIN customers c ON c.id=x.customer_id LEFT JOIN users u ON u.id=x.executive_id LEFT JOIN leads l ON l.id=x.lead_id LEFT JOIN lookups p ON p.id=x.payment_term_id`;
r.get('/quotations', need('lead_management', 'view'), ah((req, res) => {
  const t = T(req), p = [t];
  let w = 'x.tenant_id=?';
  if (req.query.status) { w += ' AND x.status=?'; p.push(req.query.status); }
  if (req.query.customer) { w += ' AND x.customer_id=?'; p.push(req.query.customer); }
  if (req.query.q) { w += ' AND (x.number LIKE ? OR c.display_name LIKE ?)'; p.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const ids = visibleUsers(req.user);
  if (ids) w += ` AND x.executive_id IN (${inList(ids)})`;
  const rows = q(`${QSEL} WHERE ${w} ORDER BY x.id DESC LIMIT 500`, ...p);
  // auto-expire in listing
  const today = ymd();
  res.json(rows.map((x) => (x.status === 'Sent' && x.valid_upto && x.valid_upto < today ? { ...x, status: 'Expired' } : x)));
}));
r.get('/quotations/:id', need('lead_management', 'view'), ah((req, res) => {
  const x = one(`${QSEL} WHERE x.id=? AND x.tenant_id=?`, req.params.id, T(req));
  if (!x) return res.status(404).json({ error: 'Not found' });
  res.json({ ...x, items: q('SELECT * FROM quotation_items WHERE quotation_id=?', x.id), company: settingsOf(T(req)).company, tenant: one('SELECT name FROM tenants WHERE id=?', T(req)) });
}));
r.post('/quotations', need('lead_management', 'add'), ah((req, res) => {
  if (!req.body.customer_id) return res.status(400).json({ error: 'Select a customer' });
  if (!(req.body.items || []).some((i) => i.name || i.item_id)) return res.status(400).json({ error: 'Add at least one item' });
  const id = saveQuotation(req); audit(req, 'Added', 'quotation', id, ''); res.json({ id });
}));
r.put('/quotations/:id', need('lead_management', 'edit'), ah((req, res) => { saveQuotation(req, +req.params.id); audit(req, 'Edited', 'quotation', +req.params.id, ''); res.json({ ok: true }); }));
r.post('/quotations/:id/status', need('lead_management', 'edit'), ah((req, res) => {
  const x = one('SELECT * FROM quotations WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!x) return res.status(404).json({ error: 'Not found' });
  if (!['Draft', 'Sent', 'Won', 'Lost'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  run('UPDATE quotations SET status=? WHERE id=?', req.body.status, x.id);
  if (req.body.status === 'Won' && x.lead_id) { const l = one('SELECT * FROM leads WHERE id=?', x.lead_id); const st = one("SELECT * FROM lead_statuses WHERE tenant_id=? AND nature='won' LIMIT 1", T(req)); if (l && l.nature !== 'Won') { run('UPDATE leads SET business_value=? WHERE id=?', x.total, l.id); addFollowup(req, l, { status_id: st?.id, description: `Quotation ${x.number} accepted` }); } }
  res.json({ ok: true });
}));
r.delete('/quotations/:id', need('lead_management', 'delete'), ah((req, res) => { run('DELETE FROM quotation_items WHERE quotation_id=?', req.params.id); run('DELETE FROM quotations WHERE id=? AND tenant_id=?', req.params.id, T(req)); res.json({ ok: true }); }));

// ======================= Sales targets =======================
r.get('/targets', need('sales_target', 'view'), ah((req, res) => {
  const t = T(req), year = +req.query.year || new Date().getFullYear(), type = req.query.type || 'Amount';
  const users = q("SELECT id,name FROM users WHERE tenant_id=? AND active=1 ORDER BY name", t);
  const rows = q('SELECT user_id,month,value FROM sales_targets WHERE tenant_id=? AND year=? AND type=?', t, year, type);
  const basis = settingsOf(t).enquiry.target_basis;
  const valExpr = type === 'Won Leads Count' ? '1' : basis === 'Quotation Value' ? 'COALESCE((SELECT total FROM quotations WHERE lead_id=l.id ORDER BY id DESC LIMIT 1), l.business_value)' : basis === 'Profit Value' ? 'l.business_value*0.2' : 'l.business_value';
  const ach = q(`SELECT assignee_id user_id, CAST(substr(won_at,6,2) AS INT) month, SUM(${valExpr}) value FROM leads l WHERE tenant_id=? AND nature='Won' AND substr(won_at,1,4)=? GROUP BY 1,2`, t, String(year));
  res.json({ year, type, users, targets: rows, achieved: ach });
}));
r.put('/targets', need('sales_target', 'edit'), ah((req, res) => {
  const { year, type, values } = req.body, t = T(req);
  const tx = db.transaction(() => { for (const v of values) run('INSERT INTO sales_targets(tenant_id,year,type,user_id,month,value) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant_id,year,type,user_id,month) DO UPDATE SET value=excluded.value', t, year, type, v.user_id, v.month, +v.value || 0); });
  tx(); audit(req, 'Edited', 'sales target', 0, `${type} ${year}`); res.json({ ok: true });
}));

// ======================= Expenses & commission =======================
r.get('/expenses', need('lead_expense', 'view'), ah((req, res) => {
  const t = T(req), p = [t]; let w = 'e.tenant_id=?';
  if (req.query.source) { w += ' AND e.source_id=?'; p.push(req.query.source); }
  if (req.query.from) { w += ' AND e.date>=?'; p.push(req.query.from); }
  if (req.query.to) { w += ' AND e.date<=?'; p.push(req.query.to); }
  const rows = q(`SELECT e.*, s.name source, b.name branch FROM lead_expenses e LEFT JOIN lead_sources s ON s.id=e.source_id LEFT JOIN branches b ON b.id=e.branch_id WHERE ${w} ORDER BY e.date DESC, e.id DESC`, ...p);
  const sum = (o) => rows.filter((x) => !o || x.origin === o).reduce((a, b) => a + b.amount, 0);
  res.json({ rows, total: sum(), meta: sum('meta'), manual: sum('manual') });
}));
r.post('/expenses', need('lead_expense', 'add'), ah((req, res) => {
  const b = req.body; if (!b.amount || +b.amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
  const i = run('INSERT INTO lead_expenses(tenant_id,date,source_id,branch_id,amount,description,campaign,origin) VALUES(?,?,?,?,?,?,?,?)', T(req), b.date || ymd(), b.source_id, b.branch_id || req.user.branch_id, +b.amount, b.description, b.campaign, 'manual');
  audit(req, 'Added', 'expense', i.lastInsertRowid, b.description); res.json({ id: i.lastInsertRowid });
}));
r.delete('/expenses/:id', need('lead_expense', 'delete'), ah((req, res) => { run('DELETE FROM lead_expenses WHERE id=? AND tenant_id=?', req.params.id, T(req)); res.json({ ok: true }); }));

r.get('/commissions', need('lead_source_commission', 'view'), ah((req, res) => {
  const t = T(req);
  const srcs = q('SELECT * FROM lead_sources WHERE tenant_id=? AND commission_enabled=1', t);
  const rows = srcs.map((s) => {
    const won = q("SELECT business_value v FROM leads WHERE tenant_id=? AND nature='Won' AND source_id=?", t, s.id);
    const earned = s.commission_type === 'percent' ? won.reduce((a, b) => a + b.v * s.commission_value / 100, 0) : won.length * s.commission_value;
    const pays = q('SELECT * FROM commission_payments WHERE source_id=? ORDER BY date DESC', s.id);
    const paid = pays.reduce((a, b) => a + b.amount, 0);
    return { id: s.id, source: s.name, type: s.commission_type, rate: s.commission_value, won: won.length, earned: +earned.toFixed(2), paid, tds: pays.reduce((a, b) => a + b.tds, 0), balance: +(earned - paid - pays.reduce((a, b) => a + b.tds, 0)).toFixed(2), payments: pays };
  });
  res.json({ rows, earned: rows.reduce((a, b) => a + b.earned, 0), paid: rows.reduce((a, b) => a + b.paid, 0), balance: rows.reduce((a, b) => a + b.balance, 0) });
}));
r.post('/commissions/:sourceId/pay', need('lead_source_commission', 'add'), ah((req, res) => {
  const gross = +req.body.amount; if (!(gross > 0)) return res.status(400).json({ error: 'Enter an amount' });
  const tds = req.body.tds_percent ? +(gross * req.body.tds_percent / 100).toFixed(2) : 0;
  run('INSERT INTO commission_payments(tenant_id,source_id,date,amount,tds,note) VALUES(?,?,?,?,?,?)', T(req), req.params.sourceId, req.body.date || ymd(), gross - tds, tds, req.body.note);
  audit(req, 'Added', 'commission payment', +req.params.sourceId, `₹${gross}`); res.json({ ok: true });
}));

// ======================= Call analysis (simulated AI) =======================
r.get('/call-analysis', need('call_analysis', 'view'), ah((req, res) => res.json(q(`SELECT a.*, u.name agent, c.display_name customer, l.number lead_number FROM call_analyses a LEFT JOIN users u ON u.id=a.agent_id LEFT JOIN customers c ON c.id=a.customer_id LEFT JOIN leads l ON l.id=a.lead_id WHERE a.tenant_id=? ORDER BY a.id DESC LIMIT 200`, T(req)))));
const POS = ['thank', 'great', 'happy', 'interested', 'perfect', 'good', 'sure', 'yes', 'confirm', 'love'];
const NEG = ['not interested', 'expensive', 'costly', 'complain', 'bad', 'cancel', 'angry', 'later', 'no budget', 'problem', 'delay'];
r.post('/call-analysis', need('call_analysis', 'view'), ah((req, res) => {
  const t = T(req), b = req.body;
  if (!b.transcript) return res.status(400).json({ error: 'Paste the call transcript to analyse' });
  const text = b.transcript.toLowerCase();
  const pos = POS.filter((w) => text.includes(w)).length, neg = NEG.filter((w) => text.includes(w)).length;
  const sentiment = pos > neg ? 'Positive' : neg > pos ? 'Negative' : 'Neutral';
  const score = Math.max(20, Math.min(98, 60 + pos * 8 - neg * 10 + Math.min(10, Math.floor(b.transcript.length / 200))));
  const tokens = Math.ceil(b.transcript.length / 4) + 400;
  const lead = b.lead_id ? one('SELECT * FROM leads WHERE id=?', b.lead_id) : null;
  const i = run('INSERT INTO call_analyses(tenant_id,date,agent_id,lead_id,customer_id,sentiment,score,summary,status) VALUES(?,?,?,?,?,?,?,?,?)', t, now(), b.agent_id || req.user.id, lead?.id, lead?.customer_id, sentiment, score, b.transcript.slice(0, 240), 'Analysed');
  chargeTokens(t, req.user.id, 'AI Call Analysis', `Call #${i.lastInsertRowid}`, tokens);
  res.json({ id: i.lastInsertRowid, sentiment, score, tokens, suggested_quality: score > 80 ? 'Hot' : score > 60 ? 'Warm' : 'Cold' });
}));

export default r;
