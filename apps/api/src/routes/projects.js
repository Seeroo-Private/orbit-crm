import { ah, need, newRouter } from '../core.js';
import { db, q, one, run, now, audit, getSettings, setSetting } from '../db.js';
import { TEMPLATE_DEFS } from '../pmSeed.js';
import { SOLAR_TEMPLATE } from '../pmSolar.js';
import { CCTV_TEMPLATE } from '../pmCctv.js';
import { estimate } from '../pmCalc.js';

const r = newRouter();
const T = (req) => req.user.tenant_id;
const js = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const LV0 = ['Phase', 'Module', 'Component', 'Sub-component'];

// ---------- tree helpers ----------
const span = (n) => {
  if (!n.kids?.length) return [n.off, n.off + (n.kind === 'milestone' ? 0 : n.dur)];
  let s = 1e9, e = 0;
  for (const k of n.kids) { const [a, b] = span(k); s = Math.min(s, a); e = Math.max(e, b); }
  return [s, e];
};
const total = (nodes) => nodes.reduce((m, n) => Math.max(m, span(n)[1]), 0);
const flat = (nodes, out = []) => { for (const n of nodes || []) { out.push(n); flat(n.kids, out); } return out; };
const tplStats = (nodes) => { const f = flat(nodes); return { phases: nodes.length, items: f.length, days: total(nodes), milestones: f.filter((n) => n.kind === 'milestone').length, deliverables: f.filter((n) => n.kind === 'deliverable').length }; };

function loadTree(projectId) {
  const rows = q('SELECT * FROM project_nodes WHERE project_id=? ORDER BY position, id', projectId);
  const deps = {};
  for (const d of q('SELECT d.node_id, d.dep_id FROM project_node_deps d JOIN project_nodes n ON n.id=d.node_id WHERE n.project_id=?', projectId)) (deps[d.node_id] ||= []).push(d.dep_id);
  const by = {}; const roots = [];
  for (const n of rows) by[n.id] = { id: n.id, name: n.name, kind: n.kind, off: n.start_off, dur: n.dur, res: n.resource || '', done: !!n.done, dep: deps[n.id] || [], mat: js(n.mat, []), labor: js(n.labor, []), crew: n.crew || 0, note: n.note || '', kids: [] };
  for (const n of rows) (n.parent_id && by[n.parent_id] ? by[n.parent_id].kids : roots).push(by[n.id]);
  return roots;
}
// Replace the whole structure; client ids (any string/number) are remapped so dependencies survive.
function saveTree(tenantId, projectId, tree) {
  db.transaction(() => {
    run('DELETE FROM project_node_deps WHERE node_id IN (SELECT id FROM project_nodes WHERE project_id=?)', projectId);
    run('DELETE FROM project_nodes WHERE project_id=?', projectId);
    const map = new Map(); const pending = [];
    const ins = (nodes, parent) => nodes.forEach((n, i) => {
      const kind = ['milestone', 'deliverable'].includes(n.kind) ? n.kind : 'node';
      const info = run('INSERT INTO project_nodes(tenant_id,project_id,parent_id,position,kind,name,start_off,dur,resource,done,mat,labor,crew,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        tenantId, projectId, parent, i, kind, String(n.name || 'Untitled').slice(0, 200), Math.max(0, +n.off || 0), kind === 'milestone' ? 0 : Math.max(0, +n.dur || 0), n.res || '', n.done ? 1 : 0, JSON.stringify(Array.isArray(n.mat) ? n.mat : []), JSON.stringify(Array.isArray(n.labor) ? n.labor : []), Math.max(0, +n.crew || 0), String(n.note || '').slice(0, 2000));
      map.set(String(n.id), info.lastInsertRowid);
      for (const d of n.dep || []) pending.push([info.lastInsertRowid, String(d)]);
      ins(n.kids || [], info.lastInsertRowid);
    });
    ins(tree || [], null);
    for (const [node, dep] of pending) if (map.has(dep) && map.get(dep) !== node) run('INSERT OR IGNORE INTO project_node_deps(node_id,dep_id) VALUES(?,?)', node, map.get(dep));
  })();
}
const parseProject = (p) => ({ ...p, levels: js(p.levels, LV0), resources: js(p.resources, []), settings: js(p.settings, {}), params: js(p.params, {}) });
const team = (id) => q('SELECT m.user_id, m.role, m.alloc, u.name FROM project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=?', id);
function setTeam(projectId, members = [], managerId) {
  run('DELETE FROM project_members WHERE project_id=?', projectId);
  for (const m of members) if (m.user_id && +m.user_id !== +managerId) run('INSERT OR REPLACE INTO project_members(project_id,user_id,role,alloc) VALUES(?,?,?,?)', projectId, m.user_id, m.role || '', Math.min(100, Math.max(0, +m.alloc || 100)));
}
const PF = ['name', 'description', 'client', 'category', 'manager_id', 'status', 'priority', 'budget', 'start_date', 'end_date'];

// ---------- seeding ----------
function insertTemplate(tenantId, t) {
  run('INSERT INTO project_templates(tenant_id,name,category,description,levels,resources,status,priority,budget,nodes,params,is_default,uses,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    tenantId, t.name, t.category, t.description, JSON.stringify(t.levels), JSON.stringify(t.resources), 'Planning', t.priority, t.budget, JSON.stringify(t.nodes), JSON.stringify(t.params || {}), t.is_default ?? 1, t.uses ?? 0, now());
}
export function ensureTemplates(tenantId) {
  for (const [flag, tpl] of [['pm_solar_seeded', SOLAR_TEMPLATE], ['pm_cctv_seeded', CCTV_TEMPLATE]]) {
    if (getSettings(tenantId)[flag]) continue;
    if (!one('SELECT id FROM project_templates WHERE tenant_id=? AND name=?', tenantId, tpl.name)) insertTemplate(tenantId, tpl);
    setSetting(tenantId, flag, true);
  }
  if (getSettings(tenantId).pm_seeded) return;
  if (!one('SELECT id FROM project_templates WHERE tenant_id=? AND name NOT IN (?,?)', tenantId, SOLAR_TEMPLATE.name, CCTV_TEMPLATE.name)) for (const t of TEMPLATE_DEFS) insertTemplate(tenantId, t);
  setSetting(tenantId, 'pm_seeded', true);
}
export function seedDemoProjects(tenantId) {
  ensureTemplates(tenantId);
  if (one('SELECT id FROM projects WHERE tenant_id=?', tenantId)) return;
  const users = q('SELECT id FROM users WHERE tenant_id=? AND active=1 ORDER BY id', tenantId).map((u) => u.id);
  if (!users.length) return;
  const tpl = (name) => one('SELECT * FROM project_templates WHERE tenant_id=? AND name=?', tenantId, name);
  const demo = [
    ['Atlas Billing Platform', 'Software Development', 'Northwind Logistics', 'Active', 'High', 480000, '2026-08-03', 42, 'Subscription billing platform replacing the legacy in-house system.'],
    ['Harbour View Residences', 'Residential Construction', 'Meridian Developers', 'Active', 'Critical', 12400000, '2026-03-02', 58, 'Twelve-storey residential tower, 96 units, with podium retail.'],
    ['Aurora Spring Launch', 'Marketing Campaign Launch', 'Aurora Cosmetics', 'Planning', 'Medium', 85000, '2026-12-07', 0, 'Omni-channel launch of the Spring skincare line.'],
    ['Helix ERP Rollout', 'ERP Implementation', 'Helix Manufacturing', 'At Risk', 'High', 1200000, '2026-06-15', 51, 'Finance, inventory and sales modules across three plants.'],
  ];
  demo.forEach(([name, tn, client, status, priority, budget, start, prog, desc], i) => {
    const t = tpl(tn); if (!t) return;
    const nodes = js(t.nodes, []); const T0 = total(nodes);
    const mark = (a) => a.forEach((n) => { n.done = !n.kids.length && prog > 0 && span(n)[1] <= (prog / 100) * T0; mark(n.kids); }); mark(nodes);
    const end = new Date(start + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + T0);
    const mgr = users[i % users.length];
    const info = run('INSERT INTO projects(tenant_id,code,name,description,client,template_id,category,manager_id,status,priority,budget,start_date,end_date,levels,resources,settings,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      tenantId, `PRJ-2026-${String(41 - i).padStart(3, '0')}`, name, desc, client, t.id, t.category, mgr, status, priority, budget, start, end.toISOString().slice(0, 10), t.levels, t.resources, '{}', users[0]);
    saveTree(tenantId, info.lastInsertRowid, nodes);
    users.filter((u) => u !== mgr).slice(0, 3).forEach((u, k) => run('INSERT OR IGNORE INTO project_members(project_id,user_id,role,alloc) VALUES(?,?,?,?)', info.lastInsertRowid, u, js(t.resources, [])[k + 1]?.role || 'Member', 80 - k * 15));
  });
}

// ---------- people ----------
r.get('/pm/people', need('project_management', 'view'), ah((req, res) => {
  res.json(q('SELECT u.id, u.name, d.name designation FROM users u LEFT JOIN designations d ON d.id=u.designation_id WHERE u.tenant_id=? AND u.active=1 ORDER BY u.name', T(req)));
}));
r.get('/pm/clients', need('project_management', 'view'), ah((req, res) => res.json(q('SELECT display_name FROM customers WHERE tenant_id=? ORDER BY display_name LIMIT 300', T(req)).map((c) => c.display_name))));

// ---------- templates ----------
const shapeTpl = (t, full) => {
  const nodes = js(t.nodes, []);
  const params = js(t.params, {}); const stats = tplStats(nodes); if (params.size) stats.estimate = Math.round(estimate(nodes, params.size, params).total);
  return { ...t, levels: js(t.levels, LV0), resources: js(t.resources, []), params, is_default: !!t.is_default, stats, nodes: full ? nodes : nodes.map((n) => ({ name: n.name, span: span(n) })) };
};
const TF = ['name', 'category', 'description', 'status', 'priority', 'budget'];
function tplBody(b) {
  const d = {}; for (const f of TF) if (b[f] !== undefined) d[f] = b[f];
  if (b.levels) d.levels = JSON.stringify(b.levels);
  if (b.resources) d.resources = JSON.stringify(b.resources);
  if (b.nodes) d.nodes = JSON.stringify(b.nodes);
  if (b.params) d.params = JSON.stringify(b.params);
  d.updated_at = now(); return d;
}
function setDefault(tenantId, id, category) { run('UPDATE project_templates SET is_default=0 WHERE tenant_id=? AND category=?', tenantId, category); run('UPDATE project_templates SET is_default=1 WHERE id=?', id); }

r.get('/pm/templates', need('project_templates', 'view'), ah((req, res) => {
  ensureTemplates(T(req));
  res.json(q('SELECT * FROM project_templates WHERE tenant_id=? ORDER BY category, name', T(req)).map((t) => shapeTpl(t, false)));
}));
r.get('/pm/templates/:id', need('project_templates', 'view'), ah((req, res) => {
  const t = one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', req.params.id, T(req));
  t ? res.json(shapeTpl(t, true)) : res.status(404).json({ error: 'Template not found' });
}));
r.post('/pm/templates', need('project_templates', 'add'), ah((req, res) => {
  if (!String(req.body.name || '').trim()) return res.status(400).json({ error: 'Template name is required' });
  const d = tplBody(req.body); d.tenant_id = T(req); const cols = Object.keys(d);
  const info = run(`INSERT INTO project_templates(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, ...cols.map((c) => d[c]));
  if (req.body.is_default) setDefault(T(req), info.lastInsertRowid, d.category);
  audit(req, 'Added', 'project_templates', info.lastInsertRowid, d.name);
  res.json({ id: info.lastInsertRowid });
}));
r.put('/pm/templates/:id', need('project_templates', 'edit'), ah((req, res) => {
  const t = one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const d = tplBody(req.body); const cols = Object.keys(d);
  run(`UPDATE project_templates SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=?`, ...cols.map((c) => d[c]), t.id);
  if (req.body.is_default) setDefault(T(req), t.id, d.category || t.category);
  audit(req, 'Edited', 'project_templates', t.id, d.name || t.name);
  res.json({ ok: true });
}));
r.post('/pm/templates/:id/duplicate', need('project_templates', 'add'), ah((req, res) => {
  const t = one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const info = run('INSERT INTO project_templates(tenant_id,name,category,description,levels,resources,status,priority,budget,nodes,params,is_default,uses,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,?)', t.tenant_id, `${t.name} (Copy)`, t.category, t.description, t.levels, t.resources, t.status, t.priority, t.budget, t.nodes, t.params, now());
  audit(req, 'Added', 'project_templates', info.lastInsertRowid, `${t.name} (Copy)`);
  res.json({ id: info.lastInsertRowid });
}));
r.post('/pm/templates/:id/default', need('project_templates', 'edit'), ah((req, res) => {
  const t = one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!t) return res.status(404).json({ error: 'Template not found' });
  setDefault(T(req), t.id, t.category); res.json({ ok: true });
}));
r.delete('/pm/templates/:id', need('project_templates', 'delete'), ah((req, res) => {
  const t = one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!t) return res.status(404).json({ error: 'Template not found' });
  run('DELETE FROM project_templates WHERE id=?', t.id); run('UPDATE projects SET template_id=NULL WHERE template_id=?', t.id);
  audit(req, 'Deleted', 'project_templates', t.id, t.name); res.json({ ok: true });
}));

// ---------- projects ----------
const LIST = `SELECT p.*, m.name manager,
  (SELECT COUNT(*) FROM project_nodes n WHERE n.project_id=p.id) node_count,
  (SELECT COUNT(*) FROM project_nodes n WHERE n.project_id=p.id AND n.kind='milestone') milestones,
  (SELECT COUNT(*) FROM project_nodes n WHERE n.project_id=p.id AND n.kind='milestone' AND n.done=1) milestones_done,
  (SELECT COALESCE(ROUND(100.0*SUM(CASE WHEN x.done=1 THEN x.w ELSE 0 END)/NULLIF(SUM(x.w),0)),0) FROM (SELECT n.done, CASE WHEN n.dur<1 THEN 1 ELSE n.dur END w FROM project_nodes n WHERE n.project_id=p.id AND NOT EXISTS (SELECT 1 FROM project_nodes c WHERE c.parent_id=n.id)) x) progress,
  (SELECT t.name FROM project_templates t WHERE t.id=p.template_id) template_name
  FROM projects p LEFT JOIN users m ON m.id=p.manager_id`;

r.get('/pm/projects', need('project_management', 'view'), ah((req, res) => {
  ensureTemplates(T(req));
  const rows = q(`${LIST} WHERE p.tenant_id=? ORDER BY p.start_date DESC, p.id DESC`, T(req)).map(parseProject);
  const members = {};
  for (const m of q('SELECT m.project_id, m.user_id, u.name FROM project_members m JOIN users u ON u.id=m.user_id JOIN projects p ON p.id=m.project_id WHERE p.tenant_id=?', T(req))) (members[m.project_id] ||= []).push({ user_id: m.user_id, name: m.name });
  res.json(rows.map((p) => ({ ...p, members: members[p.id] || [] })));
}));
r.get('/pm/projects/:id', need('project_management', 'view'), ah((req, res) => {
  const p = one(`${LIST} WHERE p.id=? AND p.tenant_id=?`, req.params.id, T(req));
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json({ ...parseProject(p), nodes: loadTree(p.id), team: team(p.id) });
}));
r.post('/pm/projects', need('project_management', 'add'), ah((req, res) => {
  const b = req.body; const t = T(req);
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Project name is required' });
  const code = String(b.code || '').trim() || `PRJ-${new Date().getFullYear()}-${String((one('SELECT COUNT(*) n FROM projects WHERE tenant_id=?', t).n || 0) + 1).padStart(3, '0')}`;
  if (one('SELECT id FROM projects WHERE tenant_id=? AND code=?', t, code)) return res.status(400).json({ error: `Project code ${code} already exists` });
  const tpl = b.template_id ? one('SELECT * FROM project_templates WHERE id=? AND tenant_id=?', b.template_id, t) : null;
  const mgr = b.manager_id || req.user.id;
  const tplParams = (x) => (x ? js(x.params, {}) : {});
  const info = run('INSERT INTO projects(tenant_id,code,name,description,client,template_id,category,manager_id,status,priority,budget,start_date,end_date,levels,resources,settings,params,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    t, code, b.name.trim(), b.description || '', b.client || '', tpl?.id || null, b.category || tpl?.category || 'Internal', mgr, b.status || 'Planning', b.priority || 'Medium', +b.budget || 0, b.start_date || null, b.end_date || null,
    JSON.stringify(b.levels || LV0), JSON.stringify(b.resources || []), JSON.stringify(b.settings || {}), JSON.stringify(b.params || tplParams(tpl)), req.user.id);
  saveTree(t, info.lastInsertRowid, b.nodes || []); setTeam(info.lastInsertRowid, b.team, mgr);
  if (tpl) run('UPDATE project_templates SET uses=uses+1 WHERE id=?', tpl.id);
  audit(req, 'Added', 'projects', info.lastInsertRowid, b.name);
  res.json({ id: info.lastInsertRowid });
}));
r.put('/pm/projects/:id', need('project_management', 'edit'), ah((req, res) => {
  const p = one('SELECT * FROM projects WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const d = {}; for (const f of [...PF, 'code']) if (req.body[f] !== undefined) d[f] = req.body[f];
  if (req.body.settings) d.settings = JSON.stringify(req.body.settings);
  if (req.body.params) d.params = JSON.stringify(req.body.params);
  if (req.body.resources) d.resources = JSON.stringify(req.body.resources);
  if (req.body.levels) d.levels = JSON.stringify(req.body.levels);
  if (d.code && one('SELECT id FROM projects WHERE tenant_id=? AND code=? AND id<>?', T(req), d.code, p.id)) return res.status(400).json({ error: `Project code ${d.code} already exists` });
  const cols = Object.keys(d); if (cols.length) run(`UPDATE projects SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=?`, ...cols.map((c) => d[c]), p.id);
  if (req.body.team) setTeam(p.id, req.body.team, d.manager_id ?? p.manager_id);
  audit(req, 'Edited', 'projects', p.id, d.name || p.name); res.json({ ok: true });
}));
r.put('/pm/projects/:id/structure', need('project_management', 'edit'), ah((req, res) => {
  const p = one('SELECT * FROM projects WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!p) return res.status(404).json({ error: 'Project not found' });
  if (js(p.settings, {}).lock) return res.status(409).json({ error: 'Structure is locked in project settings' });
  saveTree(T(req), p.id, req.body.nodes || []);
  audit(req, 'Edited', 'projects', p.id, `${p.name} (structure)`); res.json({ nodes: loadTree(p.id) });
}));
r.post('/pm/projects/:id/save-as-template', need('project_templates', 'add'), ah((req, res) => {
  const p = one('SELECT * FROM projects WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const strip = (a) => a.map((n) => ({ id: `n${n.id}`, key: null, name: n.name, kind: n.kind, off: n.off, dur: n.dur, res: n.res, dep: n.dep.map((d) => `n${d}`), mat: n.mat, labor: n.labor, crew: n.crew, note: n.note, kids: strip(n.kids) }));
  const info = run('INSERT INTO project_templates(tenant_id,name,category,description,levels,resources,status,priority,budget,nodes,params,is_default,uses,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,?)',
    T(req), req.body.name || `${p.name} Template`, p.category, `Saved from project ${p.code}.`, p.levels, p.resources, 'Planning', p.priority, p.budget, JSON.stringify(strip(loadTree(p.id))), p.params, now());
  audit(req, 'Added', 'project_templates', info.lastInsertRowid, p.name); res.json({ id: info.lastInsertRowid });
}));
r.delete('/pm/projects/:id', need('project_management', 'delete'), ah((req, res) => {
  const p = one('SELECT * FROM projects WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!p) return res.status(404).json({ error: 'Project not found' });
  db.transaction(() => {
    run('DELETE FROM project_node_deps WHERE node_id IN (SELECT id FROM project_nodes WHERE project_id=?)', p.id);
    run('DELETE FROM project_nodes WHERE project_id=?', p.id); run('DELETE FROM project_members WHERE project_id=?', p.id); run('DELETE FROM projects WHERE id=?', p.id);
  })();
  audit(req, 'Deleted', 'projects', p.id, p.name); res.json({ ok: true });
}));

export default r;
