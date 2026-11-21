import { ah, need, can, newRouter, visibleUsers, inList, q, one } from '../core.js';
import { periodRange, rangeSql, ymd, addDays, startOfWeek } from '../lib.js';
import { settingsOf } from './masters.js';

const r = newRouter();
const T = (req) => req.user.tenant_id;
const pct = (a, b) => (b ? +((a / b) * 100).toFixed(1) : 0);
const sum = (rows, k) => rows.reduce((a, b) => a + (+b[k] || 0), 0);
const localNow = () => { const d = new Date(); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// shared lead filter for dashboards/reports
function leadWhere(req, f, dateCol = 'l.created_at') {
  const p = [T(req)]; let w = 'l.tenant_id=?';
  const ids = visibleUsers(req.user);
  if (ids) { w += ` AND l.assignee_id IN (${inList(ids)})`; }
  for (const [k, col] of [['branch', 'l.branch_id'], ['assignee', 'l.assignee_id'], ['source', 'l.source_id']]) if (f[k]) { w += ` AND ${col}=?`; p.push(f[k]); }
  w += rangeSql(dateCol, periodRange(f.period, f.from, f.to), p);
  return { w, p };
}

// ====================== Home ======================
r.get('/home', ah((req, res) => {
  const t = T(req), me = req.user.id, today = ymd(), nowStr = localNow();
  const mine = 'l.tenant_id=? AND l.assignee_id=?';
  const newLeads = one(`SELECT COUNT(*) n FROM leads l WHERE ${mine} AND l.nature='New'`, t, me).n;
  const follow = one(`SELECT COUNT(*) n FROM leads l WHERE ${mine} AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1 AND substr(l.next_followup,1,10)=?`, t, me, today).n;
  const delayed = one(`SELECT COUNT(*) n FROM leads l WHERE ${mine} AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1 AND l.next_followup<?`, t, me, today).n;
  const done = one('SELECT COUNT(*) n FROM followups WHERE tenant_id=? AND user_id=? AND substr(created_at,1,10)=?', t, me, today).n;
  const tasks = {
    pending: one("SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND host_id=? AND status IN ('pending','running','hold') AND (scheduled_at IS NULL OR scheduled_at>=?)", t, me, nowStr).n,
    today: one("SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND host_id=? AND substr(scheduled_at,1,10)=? AND status<>'done'", t, me, today).n,
    delayed: one("SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND host_id=? AND status='pending' AND scheduled_at<?", t, me, nowStr).n,
    completed: one("SELECT COUNT(*) n FROM tasks WHERE tenant_id=? AND host_id=? AND status='done' AND substr(ended_at,1,10)=?", t, me, today).n,
  };
  const schedule = q(`SELECT l.id,l.number,l.next_followup,l.quality,c.display_name customer,c.phone,s.name source,st.name status,
      (SELECT GROUP_CONCAT(COALESCE(li.item_name,''),', ') FROM lead_items li WHERE li.lead_id=l.id) items
      FROM leads l LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_sources s ON s.id=l.source_id LEFT JOIN lead_statuses st ON st.id=l.status_id
      WHERE ${mine} AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1 AND substr(l.next_followup,1,10)<=? ORDER BY l.next_followup LIMIT 20`, t, me, today);
  const taskList = q("SELECT t.id,t.title,t.type,t.scheduled_at,t.status,t.priority FROM tasks t WHERE t.tenant_id=? AND t.host_id=? AND substr(t.scheduled_at,1,10)=? AND t.status<>'done' ORDER BY t.scheduled_at", t, me, today);
  const itemSummary = settingsOf(t).enquiry.item_summary_home ? q(`SELECT COALESCE(li.item_name,'Other') item, COUNT(DISTINCT l.id) n FROM lead_items li JOIN leads l ON l.id=li.lead_id WHERE l.tenant_id=? AND l.assignee_id=? AND l.nature NOT IN ('Won','Lost') GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, t, me) : null;
  res.json({ leads: { new: newLeads, followups: follow, delayed, completed: done }, tasks, schedule, taskList, itemSummary });
}));

// ====================== CRM dashboard ======================
r.get('/dashboard/crm', need('crm_dashboard', 'view'), ah((req, res) => {
  const f = req.query, t = T(req), { w, p } = leadWhere(req, f);
  const leads = q(`SELECT l.*, s.name source, a.name assignee, st.name status FROM leads l LEFT JOIN lead_sources s ON s.id=l.source_id LEFT JOIN users a ON a.id=l.assignee_id LEFT JOIN lead_statuses st ON st.id=l.status_id WHERE ${w}`, ...p);
  const bucket = (fn) => { const rows = leads.filter(fn); return { count: rows.length, value: sum(rows, 'business_value') }; };
  const total = leads.length, won = bucket((l) => l.nature === 'Won'), lost = bucket((l) => l.nature === 'Lost');
  const open = leads.filter((l) => l.nature !== 'Won' && l.nature !== 'Lost');
  const tiles = {
    total: { count: total, value: sum(leads, 'business_value') }, won, lost, new: bucket((l) => l.nature === 'New'),
    not_connected: bucket((l) => l.quality === 'Not Connected'), not_reachable: bucket((l) => l.quality === 'Not Reachable'),
    cold: bucket((l) => l.quality === 'Cold' && l.nature !== 'Won' && l.nature !== 'Lost'), warm: bucket((l) => l.nature === 'Warm'), hot: bucket((l) => l.nature === 'Hot'), super_hot: bucket((l) => l.nature === 'Super Hot'),
  };
  const kpis = {
    win_rate: pct(won.count, won.count + lost.count), conversion_rate: pct(won.count, total), lost_rate: pct(lost.count, total),
    pipeline_value: sum(open, 'business_value'), active_pipeline_ratio: pct(open.length, total), hot_ratio: pct(tiles.hot.count, total), super_hot_ratio: pct(tiles.super_hot.count, total),
  };
  // follow-up ring (current open leads, scope-aware)
  const today = ymd();
  const fp = [t]; let fw = "l.tenant_id=? AND l.nature NOT IN ('Won','Lost') AND l.followup_required=1";
  const ids = visibleUsers(req.user); if (ids) fw += ` AND l.assignee_id IN (${inList(ids)})`;
  const fl = q(`SELECT substr(l.next_followup,1,10) d FROM leads l WHERE ${fw}`, ...fp);
  const ring = { today: fl.filter((x) => x.d === today).length, delayed: fl.filter((x) => x.d && x.d < today).length, upcoming: fl.filter((x) => x.d && x.d > today).length };
  // time series
  const days = {};
  for (const l of leads) { const d = l.created_at.slice(0, 10); (days[d] ||= { date: d, leads: 0, won: 0 }).leads++; }
  for (const l of leads) if (l.won_at) { const d = l.won_at.slice(0, 10); (days[d] ||= { date: d, leads: 0, won: 0 }).won++; }
  const series = Object.values(days).sort((a, b) => (a.date < b.date ? -1 : 1));
  const group = (key, nameKey) => Object.values(leads.reduce((acc, l) => { const k = l[key] ?? 0; const g = (acc[k] ||= { id: k, name: l[nameKey] || 'Unassigned', leads: 0, won: 0, lost: 0, open: 0, value: 0, won_value: 0 }); g.leads++; g.value += l.business_value || 0; if (l.nature === 'Won') { g.won++; g.won_value += l.business_value || 0; } else if (l.nature === 'Lost') g.lost++; else g.open++; return acc; }, {}));
  const spend = Object.fromEntries(q('SELECT source_id, SUM(amount) a FROM lead_expenses WHERE tenant_id=? GROUP BY source_id', t).map((x) => [x.source_id, x.a]));
  const sources = group('source_id', 'source').map((s) => ({ ...s, conversion: pct(s.won, s.leads), spend: spend[s.id] || 0, roi: spend[s.id] ? +(((s.won_value - spend[s.id]) / spend[s.id]) * 100).toFixed(0) : null, cpl: spend[s.id] && s.leads ? +(spend[s.id] / s.leads).toFixed(0) : null }));
  const team = group('assignee_id', 'assignee').map((x) => ({ ...x, conversion: pct(x.won, x.leads) }));
  const pipeline = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Nurture', 'Won', 'Lost'].map((s) => ({ stage: s, count: leads.filter((l) => l.stage === s).length, value: sum(leads.filter((l) => l.stage === s), 'business_value') }));
  const byStatus = Object.values(leads.reduce((acc, l) => { const k = l.status || 'New Enquiry'; (acc[k] ||= { name: k, count: 0 }).count++; return acc; }, {}));
  const items = q(`SELECT COALESCE(li.item_name,'Other') name, COUNT(DISTINCT l.id) leads, SUM(CASE WHEN l.nature='Won' THEN 1 ELSE 0 END) won, SUM(l.business_value) value FROM lead_items li JOIN leads l ON l.id=li.lead_id WHERE ${w} GROUP BY 1 ORDER BY leads DESC LIMIT 12`, ...p);
  const calls = q('SELECT sentiment, COUNT(*) n, AVG(score) score FROM call_analyses WHERE tenant_id=? GROUP BY sentiment', t);
  const callAgents = q('SELECT u.name, COUNT(*) calls, AVG(a.score) score FROM call_analyses a JOIN users u ON u.id=a.agent_id WHERE a.tenant_id=? GROUP BY u.id', t);
  // needs attention
  const nowDay = today;
  const attention = {
    delayed: open.filter((l) => l.followup_required && l.next_followup && l.next_followup.slice(0, 10) < nowDay).slice(0, 15).map((l) => ({ id: l.id, number: l.number, customer: one('SELECT display_name FROM customers WHERE id=?', l.customer_id)?.display_name, assignee: l.assignee, next_followup: l.next_followup })),
    untouched: open.filter((l) => l.nature === 'New' && l.created_at.slice(0, 10) < ymd(addDays(new Date(), -1))).slice(0, 15).map((l) => ({ id: l.id, number: l.number, customer: one('SELECT display_name FROM customers WHERE id=?', l.customer_id)?.display_name, assignee: l.assignee, created_at: l.created_at })),
    no_next: open.filter((l) => l.nature !== 'New' && l.followup_required && !l.next_followup).slice(0, 15).map((l) => ({ id: l.id, number: l.number, customer: one('SELECT display_name FROM customers WHERE id=?', l.customer_id)?.display_name, assignee: l.assignee })),
    sla: leads.filter((l) => l.sla_breached).length,
  };
  res.json({ tiles, kpis, ring, series, sources, team, pipeline, byStatus, items, calls, callAgents, attention });
}));

// ====================== Executive performance ======================
function execPerf(req, f) {
  const t = T(req), year = new Date().getFullYear();
  const range = periodRange(f.period || 'month', f.from, f.to);
  const sla = settingsOf(t).enquiry.sla_minutes;
  const users = q('SELECT id,name FROM users WHERE tenant_id=? AND active=1', t);
  const ids = visibleUsers(req.user); const list = ids ? users.filter((u) => ids.includes(u.id)) : users;
  return list.map((u) => {
    const lp = [t, u.id]; const lw = rangeSql('l.created_at', range, lp);
    const leads = q(`SELECT * FROM leads l WHERE l.tenant_id=? AND l.assignee_id=? ${lw}`, ...lp);
    const won = leads.filter((l) => l.nature === 'Won'), lost = leads.filter((l) => l.nature === 'Lost'), open = leads.filter((l) => l.nature !== 'Won' && l.nature !== 'Lost');
    const target = one("SELECT SUM(value) v FROM sales_targets WHERE tenant_id=? AND year=? AND type='Amount' AND user_id=?", t, year, u.id).v || 0;
    const wonAll = one("SELECT SUM(business_value) v FROM leads WHERE tenant_id=? AND assignee_id=? AND nature='Won' AND substr(won_at,1,4)=?", t, u.id, String(year)).v || 0;
    const delayed = open.filter((l) => l.followup_required && l.next_followup && l.next_followup.slice(0, 10) < ymd()).length;
    const calls = one("SELECT COUNT(*) n, AVG(score) s FROM call_analyses WHERE tenant_id=? AND agent_id=?", t, u.id);
    const slaBreach = leads.filter((l) => l.sla_breached).length;
    const conv = pct(won.length, leads.length);
    const ach = target ? Math.min(100, pct(wonAll, target)) : conv;
    const timely = open.length ? 100 - pct(delayed, open.length) : 100;
    const slaScore = sla && leads.length ? 100 - pct(slaBreach, leads.length) : 100;
    const callScore = calls.s || 70;
    const score = Math.round(ach * 0.4 + Math.min(100, conv * 2) * 0.2 + timely * 0.2 + slaScore * 0.1 + callScore * 0.1);
    return { id: u.id, name: u.name, leads: leads.length, won: won.length, lost: lost.length, won_value: sum(won, 'business_value'), target, achievement: target ? pct(wonAll, target) : null, conversion: conv, delayed, sla_breaches: slaBreach, calls: calls.n, call_score: calls.s ? Math.round(calls.s) : null, score };
  }).sort((a, b) => b.score - a.score);
}
r.get('/dashboard/executive', need('crm_dashboard', 'view'), ah((req, res) => res.json(execPerf(req, req.query))));

// ====================== Lead forecast ======================
r.get('/dashboard/forecast', need('lead_forecast', 'view'), ah((req, res) => {
  const f = req.query, { w, p } = leadWhere(req, { ...f, period: undefined });
  const start = startOfWeek(addDays(new Date(), -7 * 11));
  const weeks = [];
  const rows = q(`SELECT substr(l.created_at,1,10) d FROM leads l WHERE ${w} AND l.created_at>=?`, ...p, start.toISOString());
  for (let i = 0; i < 12; i++) { const s = addDays(start, 7 * i), e = addDays(s, 6); weeks.push({ week: ymd(s), actual: rows.filter((x) => x.d >= ymd(s) && x.d <= ymd(e)).length }); }
  // linear regression on the last 12 weeks, floor at 0
  const n = weeks.length, xs = weeks.map((_, i) => i), ys = weeks.map((x) => x.actual);
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const icpt = my - slope * mx;
  const fc = [];
  for (let i = 0; i < 6; i++) fc.push({ week: ymd(addDays(start, 7 * (12 + i))), forecast: Math.max(0, Math.round(icpt + slope * (12 + i))) });
  const open = one(`SELECT COUNT(*) n, COALESCE(SUM(l.business_value),0) v FROM leads l WHERE ${leadWhere(req, {}).w} AND l.nature NOT IN ('Won','Lost')`, ...leadWhere(req, {}).p);
  const winRate = (() => { const o = one(`SELECT SUM(CASE WHEN nature='Won' THEN 1 ELSE 0 END) w, SUM(CASE WHEN nature='Lost' THEN 1 ELSE 0 END) l FROM leads l WHERE ${leadWhere(req, {}).w}`, ...leadWhere(req, {}).p); return pct(o.w || 0, (o.w || 0) + (o.l || 0)); })();
  res.json({ history: weeks, forecast: fc, trend: slope > 0.15 ? 'up' : slope < -0.15 ? 'down' : 'flat', expected_won_value: Math.round(open.v * winRate / 100), open_leads: open.n, win_rate: winRate });
}));

// ====================== Reports ======================
const col = (key, label, type) => ({ key, label, type });
const REPORTS = {
  customer: { title: 'Customer Report', group: 'CRM', desc: 'Customer master with contact and business details', perm: 'customer_report', run: (req) => ({
    columns: [col('display_name', 'Name'), col('type', 'Type'), col('level', 'Level'), col('phone', 'Phone'), col('email', 'Email'), col('place', 'Place'), col('owner', 'Owner'), col('enquiries', 'Enquiries', 'num')],
    rows: q('SELECT c.*, u.name owner, (SELECT COUNT(*) FROM leads l WHERE l.customer_id=c.id) enquiries FROM customers c LEFT JOIN users u ON u.id=c.owner_id WHERE c.tenant_id=? ORDER BY c.display_name', T(req)) }) },
  customer_sales: { title: 'Customer-wise Sales Report', group: 'CRM', desc: 'Orders and value per customer for a period, with first and last order', perm: 'customer_report', run: (req, f) => {
    const { w, p } = leadWhere(req, f, 'l.won_at');
    return { columns: [col('customer', 'Customer'), col('orders', 'Orders', 'num'), col('value', 'Value', 'money'), col('first', 'First order', 'date'), col('last', 'Last order', 'date')], rows: q(`SELECT c.display_name customer, COUNT(*) orders, SUM(l.business_value) value, MIN(l.won_at) first, MAX(l.won_at) last FROM leads l JOIN customers c ON c.id=l.customer_id WHERE ${w} AND l.nature='Won' GROUP BY c.id ORDER BY value DESC`, ...p) };
  } },
  leads: { title: 'Leads Report', group: 'CRM', desc: 'Lead pipeline by status, source and executive', perm: 'enquiry_report', run: (req, f) => {
    const { w, p } = leadWhere(req, f);
    return { columns: [col('number', '#', 'num'), col('customer', 'Customer'), col('items', 'Enquired for'), col('status', 'Status'), col('nature', 'Nature'), col('source', 'Source'), col('assignee', 'Executive'), col('business_value', 'Value', 'money'), col('created_at', 'Created', 'date')], rows: q(`SELECT l.number, c.display_name customer, COALESCE(st.name,'New Enquiry') status, l.nature, s.name source, a.name assignee, l.business_value, l.created_at, (SELECT GROUP_CONCAT(item_name,', ') FROM lead_items WHERE lead_id=l.id) items FROM leads l LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_statuses st ON st.id=l.status_id LEFT JOIN lead_sources s ON s.id=l.source_id LEFT JOIN users a ON a.id=l.assignee_id WHERE ${w} ORDER BY l.id DESC`, ...p) };
  } },
  lead_funnel: { title: 'Lead Funnel Report', group: 'CRM', desc: 'Stage by stage conversion, with value and win rate', perm: 'lead_funnel', run: (req, f) => {
    const { w, p } = leadWhere(req, f); const leads = q(`SELECT * FROM leads l WHERE ${w}`, ...p);
    const order = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won']; const total = leads.length;
    return { columns: [col('stage', 'Stage'), col('count', 'Leads', 'num'), col('value', 'Value', 'money'), col('share', 'Share of all %', 'num')], rows: order.map((s) => { const rows = leads.filter((l) => l.stage === s); return { stage: s, count: rows.length, value: sum(rows, 'business_value'), share: pct(rows.length, total) }; }).concat([{ stage: 'Lost', count: leads.filter((l) => l.nature === 'Lost').length, value: sum(leads.filter((l) => l.nature === 'Lost'), 'business_value'), share: pct(leads.filter((l) => l.nature === 'Lost').length, total) }]), chart: 'funnel' };
  } },
  lead_source_performance: { title: 'Lead Source Performance Report', group: 'CRM', desc: 'Leads, conversion, spend and ROI for every source', perm: 'lead_source_performance', run: (req, f) => {
    const { w, p } = leadWhere(req, f); const t = T(req);
    const spend = Object.fromEntries(q('SELECT source_id, SUM(amount) a FROM lead_expenses WHERE tenant_id=? GROUP BY source_id', t).map((x) => [x.source_id, x.a]));
    const rows = q(`SELECT s.id, s.name source, COUNT(l.id) leads, SUM(CASE WHEN l.nature='Won' THEN 1 ELSE 0 END) won, SUM(CASE WHEN l.nature='Won' THEN l.business_value ELSE 0 END) revenue FROM lead_sources s LEFT JOIN leads l ON l.source_id=s.id AND ${w} WHERE s.tenant_id=? GROUP BY s.id ORDER BY leads DESC`, ...p, t)
      .map((x) => ({ ...x, conversion: pct(x.won, x.leads), spend: spend[x.id] || 0, cpl: x.leads && spend[x.id] ? Math.round(spend[x.id] / x.leads) : null, roi: spend[x.id] ? Math.round(((x.revenue - spend[x.id]) / spend[x.id]) * 100) : null }));
    return { columns: [col('source', 'Source'), col('leads', 'Leads', 'num'), col('won', 'Won', 'num'), col('conversion', 'Conversion %', 'num'), col('revenue', 'Revenue', 'money'), col('spend', 'Spend', 'money'), col('cpl', 'Cost / lead', 'money'), col('roi', 'ROI %', 'num')], rows };
  } },
  followup_activity: { title: 'Follow-up Activity Report', group: 'CRM', desc: 'What each executive actually did - follow-ups and calls', perm: 'followup_activity', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('fu.created_at', periodRange(f.period || 'month', f.from, f.to), p);
    const rows = q(`SELECT u.name executive, COUNT(fu.id) followups, SUM(CASE WHEN fu.status_id IN (SELECT id FROM lead_statuses WHERE nature='won') THEN 1 ELSE 0 END) won, SUM(CASE WHEN fu.status_id IN (SELECT id FROM lead_statuses WHERE nature='lost') THEN 1 ELSE 0 END) lost, COUNT(DISTINCT fu.lead_id) leads_touched FROM users u LEFT JOIN followups fu ON fu.user_id=u.id AND fu.tenant_id=? ${dw} WHERE u.tenant_id=${T(req)} GROUP BY u.id ORDER BY followups DESC`, ...p);
    const calls = Object.fromEntries(q("SELECT host_id, COUNT(*) n FROM tasks WHERE tenant_id=? AND type='Call' AND status='done' GROUP BY host_id", T(req)).map((x) => [x.host_id, x.n]));
    return { columns: [col('executive', 'Executive'), col('followups', 'Follow-ups', 'num'), col('leads_touched', 'Leads touched', 'num'), col('won', 'Won', 'num'), col('lost', 'Lost', 'num'), col('calls', 'Calls done', 'num')], rows: rows.map((x, i) => ({ ...x, calls: calls[q('SELECT id FROM users WHERE tenant_id=? AND name=?', T(req), x.executive)[0]?.id] || 0 })) };
  } },
  lost_lead_analysis: { title: 'Lost Lead Analysis Report', group: 'CRM', desc: 'Why deals were lost, by reason, source and executive', perm: 'lost_lead_analysis', run: (req, f) => {
    const { w, p } = leadWhere(req, f);
    const rows = q(`SELECT COALESCE(l.lost_reason,'Unspecified') reason, COUNT(*) leads, SUM(l.business_value) value, (SELECT s2.name FROM leads l2 JOIN lead_sources s2 ON s2.id=l2.source_id WHERE l2.lost_reason=l.lost_reason AND l2.tenant_id=l.tenant_id AND l2.nature='Lost' GROUP BY s2.id ORDER BY COUNT(*) DESC LIMIT 1) top_source, (SELECT a2.name FROM leads l3 JOIN users a2 ON a2.id=l3.assignee_id WHERE l3.lost_reason=l.lost_reason AND l3.tenant_id=l.tenant_id AND l3.nature='Lost' GROUP BY a2.id ORDER BY COUNT(*) DESC LIMIT 1) top_executive FROM leads l WHERE ${w} AND l.nature='Lost' GROUP BY l.lost_reason ORDER BY leads DESC`, ...p);
    return { columns: [col('reason', 'Reason'), col('leads', 'Leads', 'num'), col('value', 'Value lost', 'money'), col('top_source', 'Most common source'), col('top_executive', 'Most common executive')], rows };
  } },
  lead_aging: { title: 'Lead Aging Report', group: 'CRM', desc: 'Open leads by how long they have gone untouched', perm: 'lead_aging', run: (req, f) => {
    const { w, p } = leadWhere(req, { ...f, period: undefined });
    const leads = q(`SELECT l.id,l.number,c.display_name customer,a.name assignee,l.business_value,COALESCE((SELECT MAX(created_at) FROM followups WHERE lead_id=l.id), l.created_at) touched FROM leads l LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN users a ON a.id=l.assignee_id WHERE ${w} AND l.nature NOT IN ('Won','Lost')`, ...p);
    const days = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
    const b = (d) => (d <= 3 ? '0–3 days' : d <= 7 ? '4–7 days' : d <= 15 ? '8–15 days' : d <= 30 ? '16–30 days' : '30+ days');
    return { columns: [col('number', '#', 'num'), col('customer', 'Customer'), col('assignee', 'Executive'), col('business_value', 'Value', 'money'), col('days', 'Days untouched', 'num'), col('bucket', 'Bucket')], rows: leads.map((l) => ({ ...l, days: days(l.touched), bucket: b(days(l.touched)) })).sort((a, b2) => b2.days - a.days), group: 'bucket' };
  } },
  quotation_conversion: { title: 'Quotation Conversion Report', group: 'CRM', desc: 'Quotations raised against those won, invoiced and expired', perm: 'quotation_conversion', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('x.date', periodRange(f.period, f.from, f.to), p); const today = ymd();
    const rows = q(`SELECT x.status, x.valid_upto, x.total, x.executive_id, u.name executive FROM quotations x LEFT JOIN users u ON u.id=x.executive_id WHERE x.tenant_id=? ${dw}`, ...p).map((x) => ({ ...x, status: x.status === 'Sent' && x.valid_upto && x.valid_upto < today ? 'Expired' : x.status }));
    const by = Object.values(rows.reduce((a, x) => { const g = (a[x.executive || '—'] ||= { executive: x.executive || '—', raised: 0, won: 0, expired: 0, value: 0, won_value: 0 }); g.raised++; g.value += x.total; if (x.status === 'Won') { g.won++; g.won_value += x.total; } if (x.status === 'Expired') g.expired++; return a; }, {}));
    return { columns: [col('executive', 'Executive'), col('raised', 'Raised', 'num'), col('won', 'Won', 'num'), col('expired', 'Expired', 'num'), col('conversion', 'Conversion %', 'num'), col('value', 'Quoted value', 'money'), col('won_value', 'Won value', 'money')], rows: by.map((x) => ({ ...x, conversion: pct(x.won, x.raised) })) };
  } },
  lead_transfer: { title: 'Lead Transfer Report', group: 'CRM', desc: 'Leads moved between executives - who gave, who received and who moved them', perm: 'lead_transfer_report', run: (req) => ({
    columns: [col('created_at', 'When', 'date'), col('number', 'Lead #', 'num'), col('customer', 'Customer'), col('from_name', 'From'), col('to_name', 'To'), col('mover', 'Moved by'), col('status', 'Type')],
    rows: q(`SELECT x.created_at, l.number, c.display_name customer, a.name from_name, b.name to_name, m.name mover, x.status FROM lead_transfers x JOIN leads l ON l.id=x.lead_id LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN users a ON a.id=x.from_user LEFT JOIN users b ON b.id=x.to_user LEFT JOIN users m ON m.id=x.requested_by WHERE x.tenant_id=? ORDER BY x.id DESC`, T(req)) }) },
  followup_log: { title: 'Followup Log Report', group: 'CRM', desc: 'How many leads were in each status or quality, and how they moved between them', perm: 'followup_log', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('fu.created_at', periodRange(f.period, f.from, f.to), p);
    return { columns: [col('created_at', 'When', 'date'), col('number', 'Lead #', 'num'), col('customer', 'Customer'), col('status', 'Status'), col('quality', 'Quality'), col('stage', 'Stage'), col('user', 'By'), col('description', 'Note')], rows: q(`SELECT fu.created_at, l.number, c.display_name customer, COALESCE(s.name,'—') status, fu.quality, fu.stage, u.name user, fu.description FROM followups fu JOIN leads l ON l.id=fu.lead_id LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_statuses s ON s.id=fu.status_id LEFT JOIN users u ON u.id=fu.user_id WHERE fu.tenant_id=? ${dw} ORDER BY fu.id DESC LIMIT 1000`, ...p) };
  } },
  executive_performance: { title: 'Executive Performance', group: 'CRM', desc: 'Scorecard per executive - leads, targets, SLA and calls', perm: 'crm_dashboard', run: (req, f) => ({
    columns: [col('name', 'Executive'), col('score', 'Score', 'num'), col('leads', 'Leads', 'num'), col('won', 'Won', 'num'), col('lost', 'Lost', 'num'), col('conversion', 'Conversion %', 'num'), col('won_value', 'Won value', 'money'), col('achievement', 'Target ach. %', 'num'), col('delayed', 'Delayed', 'num'), col('sla_breaches', 'SLA breaches', 'num'), col('calls', 'Calls', 'num')], rows: execPerf(req, f) }) },
  task_status: { title: 'Task Status Report', group: 'Task Management', desc: 'Tasks by status, type, priority and month, with the overdue list', perm: 'task_status', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('COALESCE(t.scheduled_at,t.created_at)', periodRange(f.period, f.from, f.to), p);
    const ids = visibleUsers(req.user, 'task_management'); const sc = ids ? ` AND t.host_id IN (${inList(ids)})` : '';
    const rows = q(`SELECT t.type, t.priority, t.status, substr(COALESCE(t.scheduled_at,t.created_at),1,7) month, t.scheduled_at, t.title, u.name host FROM tasks t LEFT JOIN users u ON u.id=t.host_id WHERE t.tenant_id=? ${dw}${sc}`, ...p);
    const nowStr = localNow();
    const g = Object.values(rows.reduce((a, x) => { const k = `${x.type}|${x.priority}`; const e = (a[k] ||= { type: x.type, priority: x.priority, pending: 0, running: 0, done: 0, overdue: 0, total: 0 }); e.total++; if (x.status === 'done') e.done++; else if (x.status === 'pending' && x.scheduled_at && x.scheduled_at < nowStr) e.overdue++; else if (x.status === 'pending') e.pending++; else e.running++; return a; }, {}));
    return { columns: [col('type', 'Type'), col('priority', 'Priority'), col('total', 'Total', 'num'), col('pending', 'Pending', 'num'), col('running', 'Running / hold', 'num'), col('done', 'Done', 'num'), col('overdue', 'Overdue', 'num')], rows: g };
  } },
  member_productivity: { title: 'Member Productivity Report', group: 'Task Management', desc: 'Assigned, finished, overdue, on-time and hours per member', perm: 'member_productivity', run: (req, f) => {
    const t = T(req), nowStr = localNow(); const ids = visibleUsers(req.user, 'task_management');
    const users = q('SELECT id,name FROM users WHERE tenant_id=? AND active=1', t).filter((u) => !ids || ids.includes(u.id));
    return { columns: [col('name', 'Member'), col('assigned', 'Assigned', 'num'), col('finished', 'Finished', 'num'), col('overdue', 'Overdue', 'num'), col('on_time', 'On time', 'num'), col('hours', 'Hours worked', 'num')], rows: users.map((u) => {
      const p = [t, u.id]; const dw = rangeSql('COALESCE(scheduled_at,created_at)', periodRange(f.period, f.from, f.to), p);
      const ts = q(`SELECT * FROM tasks WHERE tenant_id=? AND host_id=? ${dw}`, ...p);
      const fin = ts.filter((x) => x.status === 'done');
      return { name: u.name, assigned: ts.length, finished: fin.length, overdue: ts.filter((x) => x.status !== 'done' && x.scheduled_at && x.scheduled_at < nowStr).length, on_time: fin.filter((x) => !x.deadline || (x.ended_at || '') <= new Date(x.deadline).toISOString()).length, hours: +(sum(ts, 'seconds_worked') / 3600).toFixed(1) };
    }) };
  } },
  task_aging: { title: 'Task Aging Report', group: 'Task Management', desc: 'Open tasks by how long they have been waiting', perm: 'task_aging', run: (req) => {
    const ids = visibleUsers(req.user, 'task_management'); const sc = ids ? ` AND t.host_id IN (${inList(ids)})` : '';
    const rows = q(`SELECT t.id,t.title,t.type,t.priority,t.status,t.created_at,u.name host FROM tasks t LEFT JOIN users u ON u.id=t.host_id WHERE t.tenant_id=? AND t.status<>'done'${sc}`, T(req));
    const days = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
    const b = (d) => (d <= 3 ? '0–3 days' : d <= 7 ? '4–7 days' : d <= 15 ? '8–15 days' : d <= 30 ? '16–30 days' : '30+ days');
    return { columns: [col('title', 'Task'), col('type', 'Type'), col('priority', 'Priority'), col('host', 'Host'), col('days', 'Days waiting', 'num'), col('bucket', 'Bucket')], rows: rows.map((x) => ({ ...x, days: days(x.created_at), bucket: b(days(x.created_at)) })).sort((a, c) => c.days - a.days), group: 'bucket' };
  } },
  daily_activity: { title: 'Daily Activity Report', group: 'Task Management', desc: 'Task activity logged per day', perm: 'task_status', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('COALESCE(t.started_at,t.scheduled_at)', periodRange(f.period || 'month', f.from, f.to), p);
    const rows = q(`SELECT substr(COALESCE(t.started_at,t.scheduled_at),1,10) date, u.name host, t.title, t.type, t.status, t.seconds_worked seconds FROM tasks t LEFT JOIN users u ON u.id=t.host_id WHERE t.tenant_id=? ${dw} ORDER BY date DESC`, ...p);
    return { columns: [col('date', 'Date', 'date'), col('host', 'Member'), col('title', 'Task'), col('type', 'Type'), col('status', 'Status'), col('minutes', 'Minutes', 'num')], rows: rows.map((x) => ({ ...x, minutes: Math.round(x.seconds / 60) })) };
  } },
  attendance: { title: 'Attendance Report', group: 'HRMS', desc: 'Employee attendance for a period', perm: 'attendance_report', run: (req, f) => {
    const p = [T(req)]; const dw = rangeSql('a.date', periodRange(f.period || 'month', f.from, f.to), p);
    return { columns: [col('name', 'Employee'), col('days', 'Days present', 'num'), col('hours', 'Total hours', 'num'), col('avg', 'Avg hours / day', 'num')], rows: q(`SELECT u.name, COUNT(a.id) days, ROUND(SUM((julianday(a.check_out)-julianday(a.check_in))*24),1) hours FROM users u LEFT JOIN attendance a ON a.user_id=u.id AND a.tenant_id=? ${dw} WHERE u.tenant_id=${T(req)} AND u.active=1 GROUP BY u.id`, ...p).map((x) => ({ ...x, hours: x.hours || 0, avg: x.days ? +((x.hours || 0) / x.days).toFixed(1) : 0 })) };
  } },
  worked_hours: { title: 'Worked Hours Muster', group: 'HRMS', desc: 'Hours each employee worked on every day of a month, from check-in and check-out', perm: 'attendance_report', run: (req, f) => {
    const ym = f.month || ymd().slice(0, 7); const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    const users = q('SELECT id,name FROM users WHERE tenant_id=? AND active=1', T(req));
    const att = q('SELECT user_id,date,check_in,check_out FROM attendance WHERE tenant_id=? AND substr(date,1,7)=?', T(req), ym);
    return { columns: [col('name', 'Employee'), ...Array.from({ length: dim }, (_, i) => col(`d${i + 1}`, String(i + 1), 'num')), col('total', 'Total', 'num')], rows: users.map((u) => { const row = { name: u.name, total: 0 }; for (let i = 1; i <= dim; i++) { const a = att.find((x) => x.user_id === u.id && x.date === `${ym}-${String(i).padStart(2, '0')}`); const h = a?.check_out ? +(((new Date(a.check_out) - new Date(a.check_in)) / 36e5)).toFixed(1) : 0; row[`d${i}`] = h || ''; row.total += h; } row.total = +row.total.toFixed(1); return row; }), wide: true };
  } },
};
r.get('/reports', ah((req, res) => res.json(Object.entries(REPORTS).filter(([, v]) => can(req.user, v.perm, 'view')).map(([key, v]) => ({ key, title: v.title, group: v.group, desc: v.desc })))));
r.get('/reports/:name', ah((req, res) => {
  const rep = REPORTS[req.params.name];
  if (!rep) return res.status(404).json({ error: 'Unknown report' });
  if (!can(req.user, rep.perm, 'view')) return res.status(403).json({ error: 'Not allowed' });
  res.json({ title: rep.title, desc: rep.desc, ...rep.run(req, req.query) });
}));

// custom report runner (entity + selected columns)
const ENT = {
  leads: { sql: 'SELECT l.number,c.display_name customer,c.phone,s.name source,a.name assignee,l.nature,l.quality,l.stage,l.business_value,l.place,l.created_at FROM leads l LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN lead_sources s ON s.id=l.source_id LEFT JOIN users a ON a.id=l.assignee_id WHERE l.tenant_id=?' },
  customers: { sql: 'SELECT display_name,type,level,phone,email,place,created_at FROM customers WHERE tenant_id=?' },
  tasks: { sql: 'SELECT t.title,t.type,t.priority,t.status,t.scheduled_at,h.name host FROM tasks t LEFT JOIN users h ON h.id=t.host_id WHERE t.tenant_id=?' },
  quotations: { sql: 'SELECT x.number,c.display_name customer,x.date,x.valid_upto,x.total,x.status FROM quotations x LEFT JOIN customers c ON c.id=x.customer_id WHERE x.tenant_id=?' },
  items: { sql: 'SELECT name,code,price FROM items WHERE tenant_id=?' },
};
r.get('/dynamic-report/entities', (_q, res) => res.json(Object.fromEntries(Object.entries(ENT).map(([k, v]) => [k, v.sql.replace(/^SELECT (.*?) FROM.*$/s, '$1').split(',').map((s) => s.trim().split(/ |\./).pop())]))));
r.get('/dynamic-report/:id/run', need('dynamic_report', 'view'), ah((req, res) => {
  const rep = one('SELECT * FROM custom_reports WHERE id=? AND tenant_id=?', req.params.id, T(req));
  if (!rep) return res.status(404).json({ error: 'Not found' });
  const ent = ENT[rep.entity]; if (!ent) return res.status(400).json({ error: 'Unknown entity' });
  const cols = JSON.parse(rep.columns || '[]'); const rows = q(`${ent.sql} LIMIT 2000`, T(req));
  const use = cols.length ? cols : Object.keys(rows[0] || {});
  res.json({ title: rep.name, columns: use.map((k) => col(k, k.replace(/_/g, ' '))), rows: rows.map((x) => Object.fromEntries(use.map((k) => [k, x[k]]))) });
}));

export default r;
