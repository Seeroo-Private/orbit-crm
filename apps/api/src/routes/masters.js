import bcrypt from 'bcryptjs';
import { ah, auth, can, need, crud, newRouter, sign, PERMISSION_GROUPS, q, one, run, now, audit } from '../core.js';
import { db, getSettings, setSetting } from '../db.js';

export const DEFAULTS = {
  enquiry: {
    assign_auto: false, single_assignee: true, only_assignable: false,
    need_source: true, require_source: false, need_remark: true, require_remark: false, require_followup_remark: false,
    need_quantity: true, require_quantity: false, need_item_description: false, require_item_description: false,
    need_place: true, require_place: false, need_business_value: true, require_business_value: false,
    need_lead_quality: true, require_lead_quality: false, need_dealer: false,
    prevent_active_followup: false, repeat_business: false, after_sale: false, search_own_customers: false,
    custom_in_search: true, item_summary_home: false, item_value_column: false, lead_stage: true,
    sla_minutes: 0, transfer_response_hours: 0, auto_reassign_sla: false, sla_sources: [], ai_call_analysis: true,
    target_basis: 'Business Value', default_task: 'None', default_customer_type: 'Individual',
  },
  quotation: { quantity: true, payment_term: true, grouping: false, need_place: false, terms: 'Prices are valid for the period mentioned. Payment as per agreed terms.' },
  company: { name: '', address: '', tan: '', pan: '', pf_code: '', esi_code: '', pt_no: '', ctc_basis: 'Gross CTC' },
  codes: { employee_prefix: 'EMP', employee_next: 1, intern_separate: false, intern_prefix: 'INT', job_prefix: 'JOB', job_next: 1 },
};
export const settingsOf = (t) => {
  const s = getSettings(t);
  return Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, { ...v, ...(s[k] || {}) }]));
};

const r = newRouter();

// ---------- Auth ----------
r.post('/auth/login', ah((req, res) => {
  const { tenant, username, password } = req.body;
  const t = one('SELECT * FROM tenants WHERE UPPER(code)=UPPER(?)', tenant || '');
  if (!t) return res.status(401).json({ error: 'Unknown company code' });
  const u = one('SELECT * FROM users WHERE tenant_id=? AND LOWER(username)=LOWER(?) AND active=1', t.id, username || '');
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Wrong username or password' });
  res.json({ token: sign(u) });
}));

// ---------- Self-serve signup (free trial) ----------
export const PLANS = [
  { id: 'starter', name: 'Starter', min: 1, max: 5, per_user: 399, blurb: 'Leads, follow-ups and quotations for a small team.' },
  { id: 'growth', name: 'Growth', min: 6, max: 25, per_user: 499, blurb: 'Adds tasks, automations, reports and forecasts.' },
  { id: 'scale', name: 'Scale', min: 26, max: 100, per_user: 599, blurb: 'Multi-branch teams with SLA routing and audit trail.' },
];
const TRIAL_DAYS = 14;
const planFor = (users) => PLANS.find((p) => users >= p.min && users <= p.max);
const slugCode = (name) => {
  const base = (name || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8) || 'ORBIT';
  let code = base;
  while (one('SELECT 1 FROM tenants WHERE code=?', code)) code = base + Math.floor(100 + Math.random() * 900);
  return code;
};

r.get('/signup/plans', (_q, res) => res.json({ plans: PLANS, trial_days: TRIAL_DAYS }));

r.post('/signup', ah((req, res) => {
  const { company = {}, admin = {}, users, plan } = req.body;
  const bad = (m) => res.status(400).json({ error: m });
  if (!company.name?.trim()) return bad('Company name is required');
  if (!admin.name?.trim()) return bad('Your name is required');
  if (!/^\S+@\S+\.\S+$/.test(admin.email || '')) return bad('A valid email is required');
  if (!/^[a-z0-9._-]{3,}$/i.test(admin.username || '')) return bad('Username needs 3+ letters, digits, . _ or -');
  if (!admin.password || admin.password.length < 6) return bad('Password needs 6+ characters');
  const n = Math.floor(+users);
  const p = planFor(n);
  if (!p) return bad(`Choose between 1 and ${PLANS.at(-1).max} users (contact us for more)`);
  if (plan && plan !== p.id) return bad(`${n} users falls under the ${p.name} plan`);

  const code = slugCode(company.name);
  const renewal = new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString().slice(0, 10);
  const tx = db.transaction(() => {
    const tid = run('INSERT INTO tenants(code,name,plan,user_limit,price,renewal) VALUES(?,?,?,?,?,?)', code, company.name.trim(), p.name, n, n * p.per_user, renewal).lastInsertRowid;
    const ins = (table, o) => { const c = Object.keys(o); return run(`INSERT INTO ${table}(tenant_id,${c.join(',')}) VALUES(?,${c.map(() => '?').join(',')})`, tid, ...c.map((k) => o[k])).lastInsertRowid; };
    const branch = ins('branches', { name: 'Head Office', email: company.email || admin.email, mobile: company.phone || admin.phone || '', address: [company.address, company.city, company.state].filter(Boolean).join(', '), week_start: 'Monday' });
    const dep = ins('departments', { name: 'Sales' });
    const des = ins('designations', { name: admin.designation?.trim() || 'Owner' });
    const levels = [['Administrator', 1, 0, 1], ['Manager', 2, 0, 1], ['Team Lead', 3, 0, 0], ['Team Member', 4, 0, 0]].map(([nm, s, d, m]) => ins('user_levels', { name: nm, sort: s, dept_required: d, multi_dept: m }));
    const uid = ins('users', { username: admin.username.trim(), password_hash: bcrypt.hashSync(admin.password, 10), name: admin.name.trim(), email: admin.email.trim(), phone: admin.phone || '', designation_id: des, level_id: levels[0], department_id: dep, branch_id: branch, is_owner: 1, created_at: now() });
    [['Contacted', 'followup'], ['Follow-up Pending', 'followup'], ['Proposal Sent', 'followup'], ['Negotiation', 'followup'], ['Qualified', 'followup'], ['Won', 'won'], ['No response', 'lost'], ['Not interested', 'lost'], ['Price too high', 'lost'], ['Invalid lead', 'lost']].forEach(([name, nature], i) => ins('lead_statuses', { name, nature, sort: i + 1 }));
    ['Email', 'Facebook', 'Google Ads', 'Instagram', 'Phone Call', 'Referral', 'Walk-in', 'Website', 'WhatsApp'].forEach((name) => ins('lead_sources', { name }));
    setSetting(tid, 'company', { ...DEFAULTS.company, name: company.name.trim(), address: company.address || '' });
    return uid;
  });
  const uid = tx();
  res.json({ token: sign(one('SELECT * FROM users WHERE id=?', uid)), code, plan: p.name, trial_days: TRIAL_DAYS });
}));

const publicUser = (u) => {
  const t = one('SELECT * FROM tenants WHERE id=?', u.tenant_id);
  const { password_hash, perms, ...rest } = u;
  return { ...rest, perms, tenant: { id: t.id, code: t.code, name: t.name, plan: t.plan, user_limit: t.user_limit }, settings: settingsOf(u.tenant_id) };
};
r.get('/auth/me', auth, ah((req, res) => res.json(publicUser(req.user))));
r.patch('/auth/me', auth, ah((req, res) => {
  const { is_online, lang, name, phone, email } = req.body;
  if (is_online !== undefined) run('UPDATE users SET is_online=? WHERE id=?', +!!is_online, req.user.id);
  if (lang) run('UPDATE users SET lang=? WHERE id=?', lang, req.user.id);
  if (name) run('UPDATE users SET name=?,phone=?,email=? WHERE id=?', name, phone ?? req.user.phone, email ?? req.user.email, req.user.id);
  res.json({ ok: true });
}));
r.post('/auth/change-password', auth, ah((req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(current || '', req.user.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password needs 6+ characters' });
  run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
}));

r.use(auth);

r.get('/permissions/catalogue', (_q, res) => res.json(PERMISSION_GROUPS));

// ---------- Users ----------
const USER_SQL = `SELECT u.id,u.username,u.name,u.email,u.phone,u.designation_id,u.role_id,u.level_id,u.department_id,u.branch_id,u.reports_to,u.is_owner,u.is_online,u.active,
  d.name designation, ro.name role, l.name level, dp.name department, b.name branch, m.name reports_to_name
  FROM users u LEFT JOIN designations d ON d.id=u.designation_id LEFT JOIN access_roles ro ON ro.id=u.role_id LEFT JOIN user_levels l ON l.id=u.level_id
  LEFT JOIN departments dp ON dp.id=u.department_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN users m ON m.id=u.reports_to WHERE u.tenant_id=?`;
r.get('/users', need('users', 'view'), ah((req, res) => {
  const rows = q(`${USER_SQL} ${req.query.q ? 'AND (u.name LIKE ? OR u.username LIKE ?)' : ''} ORDER BY u.id`, req.user.tenant_id, ...(req.query.q ? [`%${req.query.q}%`, `%${req.query.q}%`] : []));
  const t = one('SELECT user_limit FROM tenants WHERE id=?', req.user.tenant_id);
  res.json({ users: rows, limit: t.user_limit, used: rows.filter((x) => x.active).length });
}));
// light list for dropdowns — any signed-in user
r.get('/people', ah((req, res) => res.json(q('SELECT id,name,username,is_online,is_owner,reports_to,branch_id,level_id FROM users WHERE tenant_id=? AND active=1 ORDER BY name', req.user.tenant_id))));
r.post('/users', need('users', 'add'), ah((req, res) => {
  const t = one('SELECT user_limit FROM tenants WHERE id=?', req.user.tenant_id);
  const used = one('SELECT COUNT(*) c FROM users WHERE tenant_id=? AND active=1', req.user.tenant_id).c;
  if (used >= t.user_limit) return res.status(403).json({ error: 'Every seat on the plan is taken. Delete a user or upgrade the plan.' });
  const b = req.body;
  if (!b.name || !b.username || !b.password) return res.status(400).json({ error: 'Name, username and password are required' });
  if (one('SELECT 1 FROM users WHERE tenant_id=? AND LOWER(username)=LOWER(?)', req.user.tenant_id, b.username)) return res.status(400).json({ error: 'Username already exists' });
  const info = run(`INSERT INTO users(tenant_id,username,password_hash,name,email,phone,designation_id,role_id,level_id,department_id,branch_id,reports_to) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    req.user.tenant_id, b.username, bcrypt.hashSync(b.password, 10), b.name, b.email, b.phone, b.designation_id || null, b.role_id || null, b.level_id || null, b.department_id || null, b.branch_id || null, b.reports_to || null);
  audit(req, 'Added', 'user', info.lastInsertRowid, b.name);
  res.json({ id: info.lastInsertRowid });
}));
r.put('/users/:id', need('users', 'edit'), ah((req, res) => {
  const b = req.body;
  run(`UPDATE users SET name=?,email=?,phone=?,designation_id=?,role_id=?,level_id=?,department_id=?,branch_id=?,reports_to=? WHERE id=? AND tenant_id=?`,
    b.name, b.email, b.phone, b.designation_id || null, b.role_id || null, b.level_id || null, b.department_id || null, b.branch_id || null, b.reports_to || null, req.params.id, req.user.tenant_id);
  audit(req, 'Edited', 'user', +req.params.id, b.name);
  res.json({ ok: true });
}));
r.delete('/users/:id', need('users', 'delete'), ah((req, res) => {
  const u = one('SELECT * FROM users WHERE id=? AND tenant_id=?', req.params.id, req.user.tenant_id);
  if (!u || u.is_owner) return res.status(400).json({ error: 'The owner cannot be deleted' });
  const to = req.body?.reassign_to || req.user.id;
  run('UPDATE leads SET assignee_id=? WHERE assignee_id=? AND tenant_id=?', to, u.id, u.tenant_id);
  run('UPDATE tasks SET host_id=? WHERE host_id=? AND tenant_id=?', to, u.id, u.tenant_id);
  run('UPDATE users SET active=0, username=username||?, reports_to=NULL WHERE id=?', `~del${u.id}`, u.id);
  run('UPDATE users SET reports_to=? WHERE reports_to=?', u.reports_to, u.id);
  audit(req, 'Deleted', 'user', u.id, u.name);
  res.json({ ok: true });
}));
r.post('/users/:id/reset-password', need('users', 'edit'), ah((req, res) => {
  if (!req.body.password || req.body.password.length < 6) return res.status(400).json({ error: 'Password needs 6+ characters' });
  run('UPDATE users SET password_hash=? WHERE id=? AND tenant_id=?', bcrypt.hashSync(req.body.password, 10), req.params.id, req.user.tenant_id);
  audit(req, 'Edited', 'user password', +req.params.id, '');
  res.json({ ok: true });
}));

// ---------- Org masters ----------
crud(r, '/branches', 'branches', { fields: ['name', 'email', 'mobile', 'address', 'week_start'], perm: 'branches' });
crud(r, '/departments', 'departments', { fields: ['name', 'parent_id'], perm: 'departments' });
crud(r, '/designations', 'designations', { fields: ['name'], perm: 'designations' });
crud(r, '/user-levels', 'user_levels', { fields: ['name', 'sort', 'dept_required', 'multi_dept'], perm: 'users', order: 'sort' });
crud(r, '/access-roles', 'access_roles', { fields: ['name', 'permissions'], perm: 'access_role', json: ['permissions'] });
r.get('/access-roles-usage', ah((req, res) => res.json(q('SELECT role_id id, COUNT(*) users FROM users WHERE tenant_id=? AND active=1 GROUP BY role_id', req.user.tenant_id))));

crud(r, '/teams', 'teams', { fields: ['name'], perm: 'teams' });
r.get('/team-members', ah((req, res) => res.json(q('SELECT tm.team_id,tm.user_id FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.tenant_id=?', req.user.tenant_id))));
r.put('/teams/:id/members', need('teams', 'edit'), ah((req, res) => {
  run('DELETE FROM team_members WHERE team_id=?', req.params.id);
  for (const uid of req.body.user_ids || []) run('INSERT OR IGNORE INTO team_members VALUES(?,?)', req.params.id, uid);
  res.json({ ok: true });
}));

// ---------- Lookups (category, group, brand, uom, packing, payment_term, dealer, currency) ----------
for (const [path, kind, perm] of [['category', 'category', 'crm_item'], ['group', 'group', 'crm_item'], ['brand', 'brand', 'crm_item'], ['uom', 'uom', 'crm_item'],
  ['packing-types', 'packing', 'item_packing_types'], ['payment-terms', 'payment_term', 'payment_term_master'], ['dealers', 'dealer', 'lead_management']]) {
  crud(r, `/lookups/${path}`, 'lookups', { fields: ['name', 'parent_id', 'extra'], perm, kind, where: `kind='${kind}'` });
}
crud(r, '/items', 'items', { fields: ['name', 'code', 'category_id', 'group_id', 'brand_id', 'uom_id', 'price', 'show_in_enquiry', 'custom'], perm: 'crm_item', search: ['name', 'code'], json: ['custom'] });

// ---------- CRM config ----------
crud(r, '/lead-statuses', 'lead_statuses', { fields: ['name', 'nature', 'sort', 'meta_event'], perm: 'followup_status_master', order: 'sort,id' });
r.post('/lead-statuses/merge', need('followup_status_master', 'edit'), ah((req, res) => {
  const { from_id, into_id } = req.body;
  run('UPDATE leads SET status_id=? WHERE status_id=? AND tenant_id=?', into_id, from_id, req.user.tenant_id);
  run('UPDATE followups SET status_id=? WHERE status_id=? AND tenant_id=?', into_id, from_id, req.user.tenant_id);
  run('DELETE FROM lead_statuses WHERE id=? AND tenant_id=?', from_id, req.user.tenant_id);
  res.json({ ok: true });
}));
crud(r, '/lead-sources', 'lead_sources', { fields: ['name', 'priority', 'commission_enabled', 'commission_type', 'commission_value'], perm: 'lead_source_master', order: 'name' });
r.get('/lead-sources-stats', ah((req, res) => res.json(q('SELECT source_id id, COUNT(*) leads FROM leads WHERE tenant_id=? GROUP BY source_id', req.user.tenant_id))));
r.post('/lead-sources/merge', need('lead_source_master', 'edit'), ah((req, res) => {
  const { from_id, into_id } = req.body;
  run('UPDATE leads SET source_id=? WHERE source_id=? AND tenant_id=?', into_id, from_id, req.user.tenant_id);
  run('DELETE FROM lead_sources WHERE id=? AND tenant_id=?', from_id, req.user.tenant_id);
  res.json({ ok: true });
}));

// ---------- Automation ----------
crud(r, '/email-templates', 'email_templates', { fields: ['name', 'subject', 'body'], perm: 'automation_master' });
crud(r, '/automations', 'automations', { fields: ['trigger_on', 'medium', 'template_id', 'trigger_at', 'send_to', 'active'], perm: 'automation_master', label: 'trigger_on' });
r.get('/automation-history', need('automation_master', 'view'), ah((req, res) => res.json(q(`SELECT l.*, a.trigger_on, t.name template FROM automation_logs l LEFT JOIN automations a ON a.id=l.automation_id LEFT JOIN email_templates t ON t.id=a.template_id WHERE l.tenant_id=? ORDER BY l.id DESC LIMIT 300`, req.user.tenant_id))));

// ---------- Customisation ----------
crud(r, '/custom-fields', 'custom_fields', { fields: ['entity', 'name', 'field_type', 'section', 'sort', 'options'], perm: 'custom_fields', order: 'entity,sort' });
crud(r, '/field-tags', 'field_tags', { fields: ['tag', 'field'], perm: 'custom_fields', search: ['tag'], label: 'tag' });
crud(r, '/custom-reports', 'custom_reports', { fields: ['name', 'entity', 'columns', 'filters'], perm: 'dynamic_report', json: ['columns', 'filters'] });
r.get('/arabic-names', ah((req, res) => res.json(getSettings(req.user.tenant_id).arabic || {})));
r.put('/arabic-names', need('custom_fields', 'edit'), ah((req, res) => { setSetting(req.user.tenant_id, 'arabic', req.body); res.json({ ok: true }); }));

crud(r, '/predefined-tasks', 'predefined_tasks', { fields: ['name', 'task_type', 'description', 'checklist'], perm: 'predefined_tasks', json: ['checklist'] });
crud(r, '/holidays', 'holidays', { fields: ['date', 'name'], perm: 'calendar', order: 'date' });
crud(r, '/quick-links', 'quick_links', { fields: ['name', 'path'], where: 'user_id=0', perm: null });

// quick links are per user
r.get('/my-quick-links', ah((req, res) => res.json(q('SELECT * FROM quick_links WHERE tenant_id=? AND user_id=? ORDER BY id', req.user.tenant_id, req.user.id))));
r.post('/my-quick-links', ah((req, res) => {
  const i = run('INSERT INTO quick_links(tenant_id,user_id,name,path) VALUES(?,?,?,?)', req.user.tenant_id, req.user.id, req.body.name, req.body.path);
  res.json({ id: i.lastInsertRowid });
}));
r.delete('/my-quick-links/:id', ah((req, res) => { run('DELETE FROM quick_links WHERE id=? AND user_id=?', req.params.id, req.user.id); res.json({ ok: true }); }));

// ---------- Settings ----------
r.get('/settings', ah((req, res) => res.json(settingsOf(req.user.tenant_id))));
const SECTION_PERM = { enquiry: 'enquiry_settings', quotation: 'quotation_settings', company: 'company_settings', codes: 'company_settings' };
r.put('/settings/:section', ah((req, res) => {
  const s = req.params.section;
  if (!DEFAULTS[s]) return res.status(404).json({ error: 'Unknown section' });
  if (!can(req.user, SECTION_PERM[s], 'edit')) return res.status(403).json({ error: 'Not allowed' });
  const next = { ...DEFAULTS[s], ...req.body };
  setSetting(req.user.tenant_id, s, next);
  audit(req, 'Edited', 'settings', 0, s);
  res.json(next);
}));

// ---------- Audit log ----------
r.get('/audit', need('user_log', 'view'), ah((req, res) => {
  res.json(q(`SELECT a.*, u.name user FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.tenant_id=? ORDER BY a.id DESC LIMIT ?`, req.user.tenant_id, +req.query.limit || 200));
}));

// ---------- Billing & tokens ----------
const PACKS = [{ id: 'starter', name: 'Starter - 1M tokens', tokens: 1_000_000, price: 499 }, { id: 'growth', name: 'Growth - 5M tokens', tokens: 5_000_000, price: 1999 }, { id: 'scale', name: 'Scale - 20M tokens', tokens: 20_000_000, price: 6999 }];
export const tokenBalance = (t) => {
  const used = one('SELECT COALESCE(SUM(tokens),0) s FROM token_usage WHERE tenant_id=?', t).s;
  const bought = one("SELECT COALESCE(SUM(tokens),0) s FROM token_purchases WHERE tenant_id=? AND status='Paid'", t).s;
  return { free: 100000, purchased: bought, used, remaining: 100000 + bought - used };
};
r.get('/tokens', ah((req, res) => {
  const t = req.user.tenant_id;
  res.json({ ...tokenBalance(t), packs: PACKS, usage: q('SELECT u.*, x.name "by" FROM token_usage u LEFT JOIN users x ON x.id=u.user_id WHERE u.tenant_id=? ORDER BY u.id DESC LIMIT 100', t), purchases: q('SELECT * FROM token_purchases WHERE tenant_id=? ORDER BY id DESC', t) });
}));
r.post('/tokens/buy', ah((req, res) => {
  const p = PACKS.find((x) => x.id === req.body.pack);
  if (!p) return res.status(400).json({ error: 'Unknown pack' });
  run('INSERT INTO token_purchases(tenant_id,pack,tokens,amount,status,created_at) VALUES(?,?,?,?,?,?)', req.user.tenant_id, p.name, p.tokens, p.price, 'Pending', now());
  res.json({ ok: true, message: 'Purchase request recorded. Payment gateway integration point.' });
}));
r.get('/billing', ah((req, res) => {
  const t = one('SELECT * FROM tenants WHERE id=?', req.user.tenant_id);
  const used = one('SELECT COUNT(*) c FROM users WHERE tenant_id=? AND active=1', t.id).c;
  res.json({ plan: t.plan, cycle: 'Monthly', users: { used, limit: t.user_limit }, whatsapp: { used: 0, limit: null }, price: t.price, tax: +(t.price * 0.18).toFixed(2), total: +(t.price * 1.18).toFixed(2), renewal: t.renewal, invoices: q('SELECT * FROM invoices WHERE tenant_id=? ORDER BY id DESC', t.id) });
}));

// ---------- Support complaints ----------
crud(r, '/complaints', 'complaints', { fields: ['subject', 'type', 'priority', 'status', 'details', 'reply'], perm: 'support_complaints', search: ['subject'], label: 'subject', before: (req, d, edit) => (edit ? d : { ...d, raised_by: req.user.id, created_at: now() }) });

export default r;
