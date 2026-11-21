import jwt from 'jsonwebtoken';
import express from 'express';
import { db, q, one, run, now, audit } from './db.js';

export const SECRET = process.env.JWT_SECRET || 'orbit-dev-secret-change-me';

// ---- Permission catalogue (drives the Access Role grid and route guards) ----
const CRUD = ['view_all', 'add', 'edit', 'delete'];
export const PERMISSION_GROUPS = [
  { name: 'Client Settings', items: [
    { key: 'enquiry_settings', label: 'Enquiry Settings', actions: ['view_all', 'edit'] },
    { key: 'quotation_settings', label: 'Quotation Settings', actions: ['view_all', 'edit'] },
    { key: 'company_settings', label: 'Company Settings', actions: ['view_all', 'edit'] },
  ] },
  { name: 'Common', items: [
    ...[['access_role', 'Access Role'], ['automation_master', 'Automation Master'], ['branches', 'Branches'], ['client_settings', 'Client Settings'],
      ['custom_fields', 'Custom Fields'], ['customers', 'Customers'], ['departments', 'Departments'], ['designations', 'Designations'],
      ['dynamic_report', 'Dynamic Report'], ['item_packing_types', 'Item Packing Types'], ['payment_term_master', 'Payment Term Master'],
      ['support_complaints', 'Support Complaints'], ['teams', 'Teams'], ['users', 'Users']].map(([key, label]) => ({ key, label, actions: CRUD })),
    ...[['ai_assistant', 'AI Assistant'], ['team_chat', 'Team Chat'], ['user_location', 'User Location'], ['user_log', 'User Log']]
      .map(([key, label]) => ({ key, label, actions: ['view_all'], viewOnly: true })),
  ] },
  { name: 'CRM', items: [
    ...[['after_sale_followup', 'After Sale Follow-up'], ['crm_dashboard', 'CRM Dashboard'], ['crm_item', 'CRM Item'], ['followup_status_master', 'Followup Status Master'],
      ['lead_expense', 'Lead Expense'], ['lead_management', 'Lead Management'], ['lead_source_commission', 'Lead Source Commission'], ['lead_source_master', 'Lead Source Master'],
      ['lead_transfer', 'Lead Transfer'], ['meta_integration', 'Meta Integration'], ['sales_target', 'Sales Target']]
      .map(([key, label]) => ({ key, label, actions: ['view_all', 'add', 'edit', 'delete', 'confirm', 'export'] })),
    ...[['call_analysis', 'Call Analysis'], ['create_leads_from_existing', 'Create Leads from Existing'], ['customer_report', 'Customer Report'], ['enquiry_report', 'Enquiry Report'],
      ['followup_activity', 'Follow-up Activity Report'], ['followup_log', 'Followup Log Report'], ['lead_aging', 'Lead Aging Report'], ['lead_forecast', 'Lead Forecast Dashboard'],
      ['lead_funnel', 'Lead Funnel Report'], ['lead_source_performance', 'Lead Source Performance Report'], ['lead_transfer_report', 'Lead Transfer Report'],
      ['lost_lead_analysis', 'Lost Lead Analysis Report'], ['quotation_conversion', 'Quotation Conversion Report']]
      .map(([key, label]) => ({ key, label, actions: ['view_all'], viewOnly: true })),
  ] },
  { name: 'HRMS', items: [{ key: 'attendance_report', label: 'Attendance Report', actions: ['view_all'], viewOnly: true }] },
  { name: 'Task Management', items: [
    { key: 'calendar', label: 'Calendar', actions: CRUD },
    { key: 'predefined_tasks', label: 'Predefined Tasks', actions: CRUD },
    { key: 'task_management', label: 'Task Management', actions: CRUD },
    ...[['member_productivity', 'Member Productivity Report'], ['task_aging', 'Task Aging Report'], ['task_status', 'Task Status Report']]
      .map(([key, label]) => ({ key, label, actions: ['view_all'], viewOnly: true })),
  ] },
  { name: 'Project Management', items: [
    { key: 'project_management', label: 'Projects', actions: CRUD },
    { key: 'project_templates', label: 'Project Templates', actions: CRUD },
  ] },
  { name: 'Upload Management', items: [{ key: 'upload_management', label: 'Upload Management', actions: ['view_all', 'add'] }] },
  { name: 'User Attributes', items: [{ key: 'user_attributes', label: 'User Attributes', actions: ['view_all', 'edit'] }] },
];

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const wrap = (s) => ({ ...s });

// ---- Auth ----
export function sign(user) {
  return jwt.sign({ id: user.id, tenant_id: user.tenant_id }, SECRET, { expiresIn: '12h' });
}
export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const p = jwt.verify(token, SECRET);
    const u = one('SELECT * FROM users WHERE id=? AND tenant_id=? AND active=1', p.id, p.tenant_id);
    if (!u) return res.status(401).json({ error: 'Account disabled' });
    const role = u.role_id ? one('SELECT permissions FROM access_roles WHERE id=?', u.role_id) : null;
    u.perms = role ? JSON.parse(role.permissions || '{}') : {};
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}
export function can(user, res, act = 'view_all') {
  if (user.is_owner) return true;
  const p = user.perms[res];
  if (!p) return false;
  if (act === 'view') return !!(p.view_all || p.add || p.edit || p.delete);
  return !!p[act];
}
export const need = (res, act = 'view_all') => (req, rs, next) =>
  can(req.user, res, act) ? next() : rs.status(403).json({ error: `Not allowed (${res}: ${act})` });

// Users whose records the current user may see (null = everyone).
export function visibleUsers(user, resKey = 'lead_management') {
  if (user.is_owner || can(user, resKey, 'view_all')) return null;
  const all = q('SELECT id,reports_to FROM users WHERE tenant_id=?', user.tenant_id);
  const out = new Set([user.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of all) if (u.reports_to && out.has(u.reports_to) && !out.has(u.id)) { out.add(u.id); grew = true; }
  }
  return [...out];
}
export const inList = (ids) => ids.length ? ids.join(',') : '0';

// ---- Generic CRUD factory ----
export function crud(router, path, table, o = {}) {
  const { fields, perm, search = ['name'], order = 'id DESC', json = [], where = '', label = 'name', before, after, kind } = o;
  const guard = (act) => perm ? need(perm, act) : (_q, _r, n) => n();
  const parse = (r) => { if (!r) return r; for (const j of json) { try { r[j] = JSON.parse(r[j]); } catch { /* keep */ } } return r; };
  const clean = (b) => {
    const d = {};
    for (const f of fields) if (b[f] !== undefined) d[f] = json.includes(f) && typeof b[f] !== 'string' ? JSON.stringify(b[f]) : (typeof b[f] === 'boolean' ? +b[f] : b[f]);
    return d;
  };
  router.get(path, guard('view'), ah((req, res) => {
    const t = req.user.tenant_id;
    const p = [t]; let sql = `SELECT * FROM ${table} WHERE tenant_id=?`;
    if (kind) { sql += ' AND kind=?'; p.push(kind); }
    if (where) sql += ` AND ${where}`;
    if (req.query.q) { sql += ` AND (${search.map((c) => `${c} LIKE ?`).join(' OR ')})`; search.forEach(() => p.push(`%${req.query.q}%`)); }
    for (const [k, v] of Object.entries(req.query)) if (fields.includes(k) && v !== '') { sql += ` AND ${k}=?`; p.push(v); }
    res.json(q(`${sql} ORDER BY ${order}`, ...p).map(parse));
  }));
  router.get(`${path}/:id`, guard('view'), ah((req, res) => {
    const r = one(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`, req.params.id, req.user.tenant_id);
    r ? res.json(parse(r)) : res.status(404).json({ error: 'Not found' });
  }));
  router.post(path, guard('add'), ah((req, res) => {
    let d = clean(req.body);
    if (kind) d.kind = kind;
    if (before) d = before(req, d) || d;
    d.tenant_id = req.user.tenant_id;
    const cols = Object.keys(d);
    const info = run(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, ...cols.map((c) => d[c]));
    audit(req, 'Added', table, info.lastInsertRowid, d[label]);
    if (after) after(req, info.lastInsertRowid, 'add');
    res.json(parse(one(`SELECT * FROM ${table} WHERE id=?`, info.lastInsertRowid)));
  }));
  router.put(`${path}/:id`, guard('edit'), ah((req, res) => {
    let d = clean(req.body);
    if (before) d = before(req, d, true) || d;
    const cols = Object.keys(d);
    if (cols.length) run(`UPDATE ${table} SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=? AND tenant_id=?`, ...cols.map((c) => d[c]), req.params.id, req.user.tenant_id);
    audit(req, 'Edited', table, +req.params.id, d[label]);
    if (after) after(req, +req.params.id, 'edit');
    res.json(parse(one(`SELECT * FROM ${table} WHERE id=?`, req.params.id)));
  }));
  router.delete(`${path}/:id`, guard('delete'), ah((req, res) => {
    const r = one(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`, req.params.id, req.user.tenant_id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    run(`DELETE FROM ${table} WHERE id=? AND tenant_id=?`, req.params.id, req.user.tenant_id);
    audit(req, 'Deleted', table, +req.params.id, r[label]);
    res.json({ ok: true });
  }));
}

export function notify(tenantId, userId, title, body, link, kind = 'info') {
  if (!userId) return;
  run('INSERT INTO notifications(tenant_id,user_id,title,body,link,kind,created_at) VALUES(?,?,?,?,?,?,?)', tenantId, userId, title, body || '', link || '', kind, now());
}

export function nextNumber(tenantId, table, col = 'number') {
  return (one(`SELECT MAX(${col}) m FROM ${table} WHERE tenant_id=?`, tenantId).m || 0) + 1;
}
export const newRouter = () => express.Router();
export { db, q, one, run, now, audit };
