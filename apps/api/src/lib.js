import { q, one, run, now } from './db.js';

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

// Named period -> [fromYmd, toYmd] inclusive (null = unbounded)
export function periodRange(name, from, to) {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  switch (name) {
    case 'today': return [ymd(t), ymd(t)];
    case 'yesterday': return [ymd(addDays(t, -1)), ymd(addDays(t, -1))];
    case 'week': { const s = startOfWeek(t); return [ymd(s), ymd(addDays(s, 6))]; }
    case 'month': return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
    case 'year': return [`${y}-01-01`, `${y}-12-31`];
    case 'prev_month': return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    case 'prev_year': return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'custom': return [from || null, to || null];
    default: return [null, null];
  }
}
// SQL fragment for a date column using ymd range
export function rangeSql(col, range, params) {
  let s = '';
  if (range[0]) { s += ` AND substr(${col},1,10)>=?`; params.push(range[0]); }
  if (range[1]) { s += ` AND substr(${col},1,10)<=?`; params.push(range[1]); }
  return s;
}

export const LEAD_SELECT = `SELECT l.*, c.display_name customer_name, c.phone, c.country_code, c.email customer_email, s.name source, a.name assignee, st.name status, st.nature status_nature, b.name branch,
 (SELECT GROUP_CONCAT(COALESCE(li.item_name,i.name),', ') FROM lead_items li LEFT JOIN items i ON i.id=li.item_id WHERE li.lead_id=l.id) items
 FROM leads l LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_sources s ON s.id=l.source_id LEFT JOIN users a ON a.id=l.assignee_id
 LEFT JOIN lead_statuses st ON st.id=l.status_id LEFT JOIN branches b ON b.id=l.branch_id`;

// Simulated automation engine: records what would be sent. Email needs a template, otherwise logs a failure reason.
export function fire(tenantId, event, lead) {
  for (const a of q('SELECT * FROM automations WHERE tenant_id=? AND active=1 AND trigger_on=?', tenantId, event)) {
    const tpl = a.template_id ? one('SELECT id FROM email_templates WHERE id=?', a.template_id) : null;
    const cust = lead.customer_id ? one('SELECT email,phone FROM customers WHERE id=?', lead.customer_id) : null;
    let status = 'Sent', reason = '';
    if (!tpl) { status = 'Failed'; reason = 'No template selected'; }
    else if (a.medium === 'Email' && a.send_to === 'Customer' && !cust?.email) { status = 'Failed'; reason = 'Customer has no email address'; }
    else if (a.medium !== 'Email' && !cust?.phone) { status = 'Failed'; reason = 'Customer has no phone number'; }
    run('INSERT INTO automation_logs(tenant_id,automation_id,lead_id,medium,status,reason,created_at) VALUES(?,?,?,?,?,?,?)', tenantId, a.id, lead.id, a.medium, status, reason, now());
  }
}

export function chargeTokens(tenantId, userId, feature, operation, tokens) {
  run('INSERT INTO token_usage(tenant_id,feature,operation,tokens,user_id,created_at) VALUES(?,?,?,?,?,?)', tenantId, feature, operation, tokens, userId, now());
}
