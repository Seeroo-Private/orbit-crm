import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_FILE = process.env.DB_FILE || path.join(here, '..', 'orbit.db');
export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

const S = `
CREATE TABLE IF NOT EXISTS tenants(id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, plan TEXT DEFAULT 'CRM + Task', user_limit INTEGER DEFAULT 5, price REAL DEFAULT 2495, renewal TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(tenant_id INTEGER, key TEXT, value TEXT, PRIMARY KEY(tenant_id,key));
CREATE TABLE IF NOT EXISTS branches(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, email TEXT, mobile TEXT, address TEXT, week_start TEXT DEFAULT 'Monday');
CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, parent_id INTEGER);
CREATE TABLE IF NOT EXISTS designations(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT);
CREATE TABLE IF NOT EXISTS user_levels(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, sort INTEGER, dept_required INTEGER DEFAULT 0, multi_dept INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS access_roles(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, permissions TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, tenant_id INTEGER, username TEXT, password_hash TEXT, name TEXT, email TEXT, phone TEXT, designation_id INTEGER, role_id INTEGER, level_id INTEGER, department_id INTEGER, branch_id INTEGER, reports_to INTEGER, is_owner INTEGER DEFAULT 0, is_online INTEGER DEFAULT 1, active INTEGER DEFAULT 1, lang TEXT DEFAULT 'en', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id,username));
CREATE TABLE IF NOT EXISTS teams(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT);
CREATE TABLE IF NOT EXISTS team_members(team_id INTEGER, user_id INTEGER, PRIMARY KEY(team_id,user_id));
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY, tenant_id INTEGER, type TEXT DEFAULT 'individual', first_name TEXT, last_name TEXT, display_name TEXT, company TEXT, phone TEXT, country_code TEXT DEFAULT '+91', secondary_phone TEXT, email TEXT, place TEXT, currency TEXT DEFAULT 'INR', level TEXT DEFAULT 'Customer', owner_id INTEGER, blocked INTEGER DEFAULT 0, custom TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS customer_contacts(id INTEGER PRIMARY KEY, tenant_id INTEGER, customer_id INTEGER, name TEXT, phone TEXT, email TEXT, designation TEXT);
CREATE TABLE IF NOT EXISTS customer_addresses(id INTEGER PRIMARY KEY, tenant_id INTEGER, customer_id INTEGER, line1 TEXT, city TEXT, state TEXT, pincode TEXT);
CREATE TABLE IF NOT EXISTS customer_changes(id INTEGER PRIMARY KEY, tenant_id INTEGER, customer_id INTEGER, field TEXT, old_value TEXT, new_value TEXT, requested_by INTEGER, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lookups(id INTEGER PRIMARY KEY, tenant_id INTEGER, kind TEXT, name TEXT, parent_id INTEGER, extra TEXT);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, code TEXT, category_id INTEGER, group_id INTEGER, brand_id INTEGER, uom_id INTEGER, price REAL DEFAULT 0, show_in_enquiry INTEGER DEFAULT 1, custom TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS lead_statuses(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, nature TEXT, sort INTEGER DEFAULT 0, meta_event TEXT);
CREATE TABLE IF NOT EXISTS lead_sources(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, priority TEXT DEFAULT 'Normal', commission_enabled INTEGER DEFAULT 0, commission_type TEXT DEFAULT 'percent', commission_value REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY, tenant_id INTEGER, number INTEGER, type TEXT DEFAULT 'enquiry', customer_id INTEGER, branch_id INTEGER, assignee_id INTEGER, status_id INTEGER, stage TEXT DEFAULT 'New', quality TEXT, nature TEXT DEFAULT 'New', business_value REAL DEFAULT 0, source_id INTEGER, dealer TEXT, remark TEXT, place TEXT, next_followup TEXT, followup_required INTEGER DEFAULT 1, lost_reason TEXT, won_at TEXT, collected REAL DEFAULT 0, created_by INTEGER, first_response_at TEXT, sla_breached INTEGER DEFAULT 0, custom TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lead_items(id INTEGER PRIMARY KEY, lead_id INTEGER, item_id INTEGER, item_name TEXT, quantity REAL DEFAULT 1, note TEXT);
CREATE TABLE IF NOT EXISTS followups(id INTEGER PRIMARY KEY, tenant_id INTEGER, lead_id INTEGER, status_id INTEGER, quality TEXT, stage TEXT, description TEXT, next_followup TEXT, business_value REAL, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lead_transfers(id INTEGER PRIMARY KEY, tenant_id INTEGER, lead_id INTEGER, from_user INTEGER, to_user INTEGER, status TEXT DEFAULT 'done', requested_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quotations(id INTEGER PRIMARY KEY, tenant_id INTEGER, number TEXT, lead_id INTEGER, customer_id INTEGER, executive_id INTEGER, source_id INTEGER, currency TEXT DEFAULT 'INR', date TEXT, valid_upto TEXT, next_followup TEXT, description TEXT, subject TEXT, customer_note TEXT, terms TEXT, payment_term_id INTEGER, discount_pct REAL DEFAULT 0, discount_amt REAL DEFAULT 0, gross REAL DEFAULT 0, total REAL DEFAULT 0, status TEXT DEFAULT 'Draft', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quotation_items(id INTEGER PRIMARY KEY, quotation_id INTEGER, item_id INTEGER, name TEXT, rate REAL, qty REAL, note TEXT);
CREATE TABLE IF NOT EXISTS sales_targets(id INTEGER PRIMARY KEY, tenant_id INTEGER, year INTEGER, type TEXT, user_id INTEGER, month INTEGER, value REAL DEFAULT 0, UNIQUE(tenant_id,year,type,user_id,month));
CREATE TABLE IF NOT EXISTS lead_expenses(id INTEGER PRIMARY KEY, tenant_id INTEGER, date TEXT, source_id INTEGER, branch_id INTEGER, amount REAL, description TEXT, campaign TEXT, origin TEXT DEFAULT 'manual');
CREATE TABLE IF NOT EXISTS commission_payments(id INTEGER PRIMARY KEY, tenant_id INTEGER, source_id INTEGER, date TEXT, amount REAL, tds REAL DEFAULT 0, note TEXT);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, tenant_id INTEGER, type TEXT, priority TEXT DEFAULT 'Normal', title TEXT, description TEXT, mode TEXT DEFAULT 'instant', status TEXT DEFAULT 'pending', scheduled_at TEXT, started_at TEXT, ended_at TEXT, deadline TEXT, host_id INTEGER, party_id INTEGER, lead_id INTEGER, checklist TEXT DEFAULT '[]', notify_done INTEGER DEFAULT 0, repeat_rule TEXT, meet_link TEXT, created_by INTEGER, seconds_worked INTEGER DEFAULT 0, custom TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS task_participants(task_id INTEGER, user_id INTEGER, role TEXT DEFAULT 'Member', PRIMARY KEY(task_id,user_id));
CREATE TABLE IF NOT EXISTS task_notes(id INTEGER PRIMARY KEY, task_id INTEGER, user_id INTEGER, text TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS predefined_tasks(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, task_type TEXT, description TEXT, checklist TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS email_templates(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, subject TEXT, body TEXT);
CREATE TABLE IF NOT EXISTS automations(id INTEGER PRIMARY KEY, tenant_id INTEGER, trigger_on TEXT, medium TEXT DEFAULT 'Email', template_id INTEGER, trigger_at TEXT DEFAULT 'Immediately', send_to TEXT DEFAULT 'Customer', active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS automation_logs(id INTEGER PRIMARY KEY, tenant_id INTEGER, automation_id INTEGER, lead_id INTEGER, medium TEXT, status TEXT, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS custom_fields(id INTEGER PRIMARY KEY, tenant_id INTEGER, entity TEXT, name TEXT, field_type TEXT DEFAULT 'text', section TEXT, sort INTEGER DEFAULT 0, options TEXT);
CREATE TABLE IF NOT EXISTS field_tags(id INTEGER PRIMARY KEY, tenant_id INTEGER, tag TEXT, field TEXT);
CREATE TABLE IF NOT EXISTS custom_reports(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, entity TEXT, columns TEXT DEFAULT '[]', filters TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, title TEXT, body TEXT, kind TEXT DEFAULT 'info', link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quick_links(id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, name TEXT, path TEXT);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, action TEXT, entity TEXT, record_id INTEGER, label TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS mail(id INTEGER PRIMARY KEY, tenant_id INTEGER, from_id INTEGER, to_id INTEGER, subject TEXT, body TEXT, is_draft INTEGER DEFAULT 0, starred INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, trashed INTEGER DEFAULT 0, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS chat_threads(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, is_group INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS chat_members(thread_id INTEGER, user_id INTEGER, last_read INTEGER DEFAULT 0, PRIMARY KEY(thread_id,user_id));
CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY, thread_id INTEGER, user_id INTEGER, text TEXT, kind TEXT DEFAULT 'text', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS token_usage(id INTEGER PRIMARY KEY, tenant_id INTEGER, feature TEXT, operation TEXT, tokens INTEGER, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS token_purchases(id INTEGER PRIMARY KEY, tenant_id INTEGER, pack TEXT, tokens INTEGER, amount REAL, status TEXT DEFAULT 'Pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, tenant_id INTEGER, no INTEGER, date TEXT, period TEXT, due TEXT, amount REAL, status TEXT DEFAULT 'Paid');
CREATE TABLE IF NOT EXISTS complaints(id INTEGER PRIMARY KEY, tenant_id INTEGER, subject TEXT, type TEXT, priority TEXT DEFAULT 'Normal', status TEXT DEFAULT 'Open', details TEXT, raised_by INTEGER, reply TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS call_analyses(id INTEGER PRIMARY KEY, tenant_id INTEGER, date TEXT, agent_id INTEGER, lead_id INTEGER, customer_id INTEGER, sentiment TEXT, score INTEGER, summary TEXT, recording_url TEXT, status TEXT DEFAULT 'Analysed');
CREATE TABLE IF NOT EXISTS user_locations(user_id INTEGER PRIMARY KEY, tenant_id INTEGER, lat REAL, lng REAL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, date TEXT, check_in TEXT, check_out TEXT);
CREATE TABLE IF NOT EXISTS leaves(id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, from_date TEXT, to_date TEXT, kind TEXT DEFAULT 'Casual', status TEXT DEFAULT 'Approved');
CREATE TABLE IF NOT EXISTS holidays(id INTEGER PRIMARY KEY, tenant_id INTEGER, date TEXT, name TEXT);
CREATE TABLE IF NOT EXISTS uploads(id INTEGER PRIMARY KEY, tenant_id INTEGER, entity TEXT, file TEXT, status TEXT, errors INTEGER DEFAULT 0, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS project_templates(id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, category TEXT, description TEXT, levels TEXT DEFAULT '[]', resources TEXT DEFAULT '[]', status TEXT DEFAULT 'Planning', priority TEXT DEFAULT 'Medium', budget REAL DEFAULT 0, nodes TEXT DEFAULT '[]', is_default INTEGER DEFAULT 0, uses INTEGER DEFAULT 0, updated_at TEXT);
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY, tenant_id INTEGER, code TEXT, name TEXT, description TEXT, client TEXT, template_id INTEGER, category TEXT, manager_id INTEGER, status TEXT DEFAULT 'Planning', priority TEXT DEFAULT 'Medium', budget REAL DEFAULT 0, start_date TEXT, end_date TEXT, levels TEXT DEFAULT '[]', resources TEXT DEFAULT '[]', settings TEXT DEFAULT '{}', created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS project_nodes(id INTEGER PRIMARY KEY, tenant_id INTEGER, project_id INTEGER, parent_id INTEGER, position INTEGER DEFAULT 0, kind TEXT DEFAULT 'node', name TEXT, start_off INTEGER DEFAULT 0, dur INTEGER DEFAULT 0, resource TEXT, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS project_node_deps(node_id INTEGER, dep_id INTEGER, PRIMARY KEY(node_id,dep_id));
CREATE TABLE IF NOT EXISTS project_members(project_id INTEGER, user_id INTEGER, role TEXT, alloc INTEGER DEFAULT 100, PRIMARY KEY(project_id,user_id));
CREATE INDEX IF NOT EXISTS i_pnodes ON project_nodes(project_id, parent_id);
CREATE INDEX IF NOT EXISTS i_leads ON leads(tenant_id, assignee_id, status_id);
CREATE INDEX IF NOT EXISTS i_follow ON followups(lead_id);
CREATE INDEX IF NOT EXISTS i_tasks ON tasks(tenant_id, host_id, status);
`;
db.exec(S);

// additive column migrations (CREATE IF NOT EXISTS does not alter existing tables)
for (const [t, c, d] of [['project_nodes', 'mat', "TEXT DEFAULT '[]'"], ['project_nodes', 'labor', "TEXT DEFAULT '[]'"], ['project_nodes', 'crew', 'INTEGER DEFAULT 0'], ['project_nodes', 'note', "TEXT DEFAULT ''"], ['projects', 'params', "TEXT DEFAULT '{}'"], ['project_templates', 'params', "TEXT DEFAULT '{}'"]]) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`);
}

export const now = () => new Date().toISOString();
export const q = (sql, ...p) => db.prepare(sql).all(...p);
export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export function getSettings(tenantId) {
  const out = {};
  for (const r of q('SELECT key,value FROM settings WHERE tenant_id=?', tenantId)) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}
export function setSetting(tenantId, key, value) {
  run('INSERT INTO settings(tenant_id,key,value) VALUES(?,?,?) ON CONFLICT(tenant_id,key) DO UPDATE SET value=excluded.value', tenantId, key, JSON.stringify(value));
}
export function audit(req, action, entity, recordId, label) {
  run('INSERT INTO audit_log(tenant_id,user_id,action,entity,record_id,label,created_at) VALUES(?,?,?,?,?,?,?)', req.user.tenant_id, req.user.id, action, entity, recordId, label || '', now());
}
