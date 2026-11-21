import bcrypt from 'bcryptjs';
import { db, q, one, run, now, setSetting } from './db.js';
import { ymd, addDays } from './lib.js';
import { DEFAULTS } from './routes/masters.js';
import { PERMISSION_GROUPS } from './core.js';

let seedN = 42;
const rnd = () => { seedN = (seedN * 1664525 + 1013904223) % 4294967296; return seedN / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const iso = (d) => d.toISOString();
const local = (d) => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const allPerms = (filter = () => true) => {
  const out = {};
  for (const g of PERMISSION_GROUPS) for (const it of g.items) if (filter(it, g)) out[it.key] = Object.fromEntries(it.actions.map((a) => [a, true]));
  return out;
};

export function seedAll() {
  for (const t of ['tenants', 'settings', 'branches', 'departments', 'designations', 'user_levels', 'access_roles', 'users', 'teams', 'team_members', 'customers', 'customer_contacts', 'customer_addresses', 'customer_changes', 'lookups', 'items', 'lead_statuses', 'lead_sources', 'leads', 'lead_items', 'followups', 'lead_transfers', 'quotations', 'quotation_items', 'sales_targets', 'lead_expenses', 'commission_payments', 'tasks', 'task_participants', 'task_notes', 'predefined_tasks', 'email_templates', 'automations', 'automation_logs', 'custom_fields', 'field_tags', 'custom_reports', 'notifications', 'quick_links', 'audit_log', 'mail', 'chat_threads', 'chat_members', 'chat_messages', 'token_usage', 'token_purchases', 'invoices', 'complaints', 'call_analyses', 'user_locations', 'attendance', 'leaves', 'holidays', 'uploads']) db.exec(`DELETE FROM ${t}`);
  seedN = 42;
  const t = run('INSERT INTO tenants(code,name,plan,user_limit,price,renewal) VALUES(?,?,?,?,?,?)', 'DEMO', 'Sunrise Solar Pvt Ltd', 'CRM + Task', 8, 2495, ymd(addDays(new Date(), 7))).lastInsertRowid;
  const ins = (table, o) => { const c = Object.keys(o); return run(`INSERT INTO ${table}(tenant_id,${c.join(',')}) VALUES(?,${c.map(() => '?').join(',')})`, t, ...c.map((k) => o[k])).lastInsertRowid; };

  // ---- structure
  const b1 = ins('branches', { name: 'Main Branch', email: 'hello@sunrisesolar.in', mobile: '9847000001', address: 'MG Road, Kochi', week_start: 'Monday' });
  const b2 = ins('branches', { name: 'Bengaluru Branch', email: 'blr@sunrisesolar.in', mobile: '9847000002', address: 'Indiranagar, Bengaluru', week_start: 'Monday' });
  const depSales = ins('departments', { name: 'Sales' }), depOps = ins('departments', { name: 'Operations' });
  ins('departments', { name: 'Inside Sales', parent_id: depSales });
  const desRoles = Object.fromEntries(['Managing Director', 'Sales Manager', 'Team Lead', 'Sales Executive', 'Site Engineer'].map((n) => [n, ins('designations', { name: n })]));
  const lv = Object.fromEntries([['Administrator', 1, 0, 1], ['Manager', 2, 0, 1], ['Team Lead', 3, 0, 0], ['Team Member', 4, 0, 0]].map(([n, s, d, m]) => [n, ins('user_levels', { name: n, sort: s, dept_required: d, multi_dept: m })]));
  const roleMgr = ins('access_roles', { name: 'Sales Manager', permissions: JSON.stringify(allPerms((it) => !['access_role', 'client_settings', 'company_settings', 'enquiry_settings', 'quotation_settings', 'automation_master'].includes(it.key))) });
  const roleExec = ins('access_roles', { name: 'Sales Executive', permissions: JSON.stringify(allPerms((it) => ['lead_management', 'customers', 'calendar', 'task_management', 'team_chat', 'ai_assistant', 'crm_dashboard', 'followup_activity', 'enquiry_report', 'customer_report', 'task_status', 'user_location'].includes(it.key) && !(it.key === 'lead_management'))) });
  // executives get lead mgmt without view_all, so they only see their own leads/team
  const execPerms = JSON.parse(one('SELECT permissions p FROM access_roles WHERE id=?', roleExec).p);
  execPerms.lead_management = { add: true, edit: true }; execPerms.customers = { view_all: true, add: true, edit: true }; execPerms.task_management = { add: true, edit: true }; execPerms.lead_transfer = { add: true };
  execPerms.crm_dashboard = { view_all: true };
  run('UPDATE access_roles SET permissions=? WHERE id=?', JSON.stringify(execPerms), roleExec);

  const hash = (p) => bcrypt.hashSync(p, 10);
  const mk = (username, name, o) => ins('users', { username, password_hash: hash(o.pw || 'demo123'), name, email: `${username}@sunrisesolar.in`, phone: o.phone, designation_id: o.des, role_id: o.role || null, level_id: o.level, department_id: o.dep, branch_id: o.branch, reports_to: o.rep || null, is_owner: o.owner ? 1 : 0, created_at: now() });
  const admin = mk('admin', 'Arjun Menon', { pw: 'admin123', phone: '9847011111', des: desRoles['Managing Director'], level: lv.Administrator, dep: depSales, branch: b1, owner: true });
  const priya = mk('priya', 'Priya Nair', { phone: '9847022222', des: desRoles['Sales Manager'], role: roleMgr, level: lv.Manager, dep: depSales, branch: b1, rep: admin });
  const rahul = mk('rahul', 'Rahul Varma', { phone: '9847033333', des: desRoles['Team Lead'], role: roleExec, level: lv['Team Lead'], dep: depSales, branch: b1, rep: priya });
  const anita = mk('anita', 'Anita Joseph', { phone: '9847044444', des: desRoles['Sales Executive'], role: roleExec, level: lv['Team Member'], dep: depSales, branch: b1, rep: rahul });
  const vikram = mk('vikram', 'Vikram Shetty', { phone: '9845055555', des: desRoles['Sales Executive'], role: roleExec, level: lv['Team Member'], dep: depSales, branch: b2, rep: priya });
  const execs = [rahul, anita, vikram, priya];
  const team = ins('teams', { name: 'Kerala Sales' }), team2 = ins('teams', { name: 'Karnataka Sales' });
  for (const u of [priya, rahul, anita]) run('INSERT INTO team_members VALUES(?,?)', team, u);
  for (const u of [vikram]) run('INSERT INTO team_members VALUES(?,?)', team2, u);

  // ---- catalogue
  const lk = (kind, name, parent) => ins('lookups', { kind, name, parent_id: parent || null });
  const catRoof = lk('category', 'Rooftop Solar'), catPump = lk('category', 'Solar Pumps'), catSvc = lk('category', 'Services');
  const brandA = lk('brand', 'SunPeak'), brandB = lk('brand', 'Luminous');
  const uomKw = lk('uom', 'kW'), uomNo = lk('uom', 'Nos');
  lk('packing', 'Box'); lk('packing', 'Pallet'); lk('packing', 'Carton');
  const ptAdv = lk('payment_term', '50% advance, 50% on commissioning'), ptNet = lk('payment_term', 'Net 30'), ptFull = lk('payment_term', '100% advance');
  lk('dealer', 'Kerala Energy Mart'); lk('dealer', 'GreenGrid Traders');
  const itemDefs = [['3 kW Residential Rooftop', 'SR-3K', 185000, catRoof, brandA, uomKw], ['5 kW Residential Rooftop', 'SR-5K', 295000, catRoof, brandA, uomKw], ['10 kW Commercial Rooftop', 'SC-10K', 560000, catRoof, brandB, uomKw], ['25 kW Industrial Rooftop', 'SI-25K', 1350000, catRoof, brandB, uomKw], ['3 HP Solar Water Pump', 'SP-3HP', 210000, catPump, brandA, uomNo], ['Solar Street Light 40W', 'SL-40W', 18500, catRoof, brandB, uomNo], ['Annual Maintenance Contract', 'AMC-1Y', 12000, catSvc, null, uomNo], ['Net-metering Liaison', 'NM-001', 8000, catSvc, null, uomNo]];
  const items = itemDefs.map(([name, code, price, category_id, brand_id, uom_id]) => ({ id: ins('items', { name, code, price, category_id, brand_id, uom_id }), name, price }));

  // ---- lead config
  const stDefs = [['Contacted', 'followup'], ['Decision Pending', 'followup'], ['Follow-up Pending', 'followup'], ['Negotiation', 'followup'], ['Proposal Sent', 'followup'], ['Qualified', 'followup'], ['Won', 'won'], ['Chose competitor', 'lost'], ['Duplicate lead', 'lost'], ['Invalid lead', 'lost'], ['No budget', 'lost'], ['No response', 'lost'], ['Not interested', 'lost'], ['Price too high', 'lost'], ['Requirement changed', 'lost']];
  const st = stDefs.map(([name, nature], i) => ({ id: ins('lead_statuses', { name, nature, sort: i + 1 }), name, nature }));
  const stFollow = st.filter((s) => s.nature === 'followup'), stWon = st.find((s) => s.nature === 'won'), stLost = st.filter((s) => s.nature === 'lost');
  const srcNames = ['Campaign', 'Email', 'Existing Customer', 'Facebook', 'Field Visit', 'Google Ads', 'Instagram', 'LinkedIn', 'Marketplace', 'Partner/Dealer', 'Phone Call', 'Referral', 'Tele calling', 'Trade Show / Expo', 'Walk-in', 'Website', 'WhatsApp'];
  const src = Object.fromEntries(srcNames.map((n) => [n, ins('lead_sources', { name: n, priority: ['Google Ads', 'Referral', 'Website'].includes(n) ? 'High' : 'Normal', commission_enabled: n === 'Partner/Dealer' || n === 'Referral' ? 1 : 0, commission_type: n === 'Referral' ? 'fixed' : 'percent', commission_value: n === 'Referral' ? 2500 : n === 'Partner/Dealer' ? 3 : 0 })]));

  // ---- settings
  setSetting(t, 'enquiry', { ...DEFAULTS.enquiry, sla_minutes: 60, target_basis: 'Business Value', default_task: 'None' });
  setSetting(t, 'quotation', { ...DEFAULTS.quotation, terms: '1. Prices include GST as applicable.\n2. Subsidy (PM Surya Ghar) processing assistance included.\n3. Installation within 30 days of advance.\n4. 25-year panel performance warranty, 5-year inverter warranty.' });
  setSetting(t, 'company', { ...DEFAULTS.company, name: 'Sunrise Solar Pvt Ltd', address: 'MG Road, Kochi, Kerala 682016', pan: 'AABCS1234F', tan: 'COKS12345A' });

  // ---- customers & leads
  const first = ['Aarav', 'Meera', 'Sanjay', 'Divya', 'Faisal', 'Lakshmi', 'Gopal', 'Nisha', 'Imran', 'Revathi', 'Arun', 'Sreeja', 'Joseph', 'Kavya', 'Mohan', 'Teena', 'Harish', 'Rekha', 'Suresh', 'Anjali', 'Bijoy', 'Pooja', 'Dinesh', 'Shilpa', 'Naveen', 'Asha', 'Ganesh', 'Leena', 'Prakash', 'Sandhya'];
  const last = ['Kumar', 'Pillai', 'Menon', 'Nair', 'Iyer', 'Thomas', 'Rao', 'Shetty', 'Varghese', 'Reddy', 'Hegde', 'Das'];
  const biz = ['Greenfield Textiles', 'Coastal Cold Storage', 'Malabar Spices Ltd', 'Orion Hospital', 'Kaveri Rice Mills', 'Zenith School', 'Lotus Apartments RWA', 'Hill View Resort'];
  const places = ['Kochi', 'Thrissur', 'Kozhikode', 'Kannur', 'Bengaluru', 'Mysuru', 'Mangaluru', 'Thiruvananthapuram'];
  const custs = [];
  for (let i = 0; i < 38; i++) {
    const isBiz = i < biz.length;
    const name = isBiz ? biz[i] : `${first[i % first.length]} ${pick(last)}`;
    const phone = String(9000000000 + between(10000000, 99999999));
    const id = ins('customers', { type: isBiz ? 'business' : 'individual', first_name: isBiz ? null : name.split(' ')[0], last_name: isBiz ? null : name.split(' ')[1], display_name: name, company: isBiz ? name : null, phone, email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`, place: pick(places), level: 'Prospect', owner_id: pick(execs), created_at: iso(addDays(new Date(), -between(5, 80))) });
    custs.push({ id, name });
    if (isBiz) ins('customer_contacts', { customer_id: id, name: `${pick(first)} ${pick(last)}`, phone: String(9000000000 + between(10000000, 99999999)), email: `accounts@${name.split(' ')[0].toLowerCase()}.in`, designation: 'Purchase Manager' });
    ins('customer_addresses', { customer_id: id, line1: `${between(1, 99)}, ${pick(['Temple Road', 'Church Street', 'Park Avenue', 'Industrial Estate'])}`, city: pick(places), state: 'Kerala', pincode: String(680000 + between(1, 900)) });
  }
  const today = new Date();
  let num = 0;
  const leadIds = [];
  for (let i = 0; i < 72; i++) {
    const c = custs[i % custs.length];
    const created = addDays(today, -between(0, 70)); created.setHours(between(9, 18), between(0, 59));
    const assignee = pick(execs);
    const outcome = rnd();
    const nature = outcome < 0.14 ? 'New' : outcome < 0.28 ? 'Won' : outcome < 0.42 ? 'Lost' : pick(['Warm', 'Warm', 'Hot', 'Hot', 'Super Hot']);
    const item = pick(items);
    const sourceName = pick(['Google Ads', 'Facebook', 'Website', 'Referral', 'Walk-in', 'Phone Call', 'Partner/Dealer', 'Instagram', 'WhatsApp', 'Existing Customer']);
    const value = Math.round(item.price * (nature === 'New' ? 1 : pick([0.95, 1, 1.05, 1.1])) / 1000) * 1000;
    const stage = nature === 'New' ? 'New' : nature === 'Won' ? 'Won' : nature === 'Lost' ? 'Lost' : pick(['Contacted', 'Qualified', 'Proposal Sent', 'Negotiation']);
    const quality = nature === 'New' ? null : nature === 'Won' || nature === 'Lost' ? pick(['Warm', 'Hot']) : nature === 'Super Hot' ? 'Super Hot' : nature === 'Hot' ? 'Hot' : pick(['Cold', 'Warm', 'Not Connected']);
    const open = !['Won', 'Lost'].includes(nature);
    const nextDays = between(-4, 6);
    const next = open ? local(new Date(addDays(today, nextDays).setHours(between(10, 17), 0))) : null;
    const wonAt = nature === 'Won' ? iso(addDays(created, between(2, 15) > 0 ? between(2, 15) : 2)) : null;
    num++;
    const lostSt = pick(stLost);
    const lid = ins('leads', { number: num, customer_id: c.id, branch_id: assignee === vikram ? b2 : b1, assignee_id: assignee, status_id: nature === 'New' ? null : nature === 'Won' ? stWon.id : nature === 'Lost' ? lostSt.id : pick(stFollow).id, stage, quality, nature, business_value: value, source_id: src[sourceName], remark: pick(['Wants subsidy details', 'Roof survey needed', 'Comparing with two vendors', 'Budget approved', 'Call after salary day', 'Needs EMI option']), place: pick(places), next_followup: next, followup_required: open ? 1 : 0, lost_reason: nature === 'Lost' ? lostSt.name : null, won_at: wonAt && wonAt < iso(today) ? wonAt : (nature === 'Won' ? iso(today) : null), collected: nature === 'Won' ? Math.round(value * pick([0, 0.5, 1])) : 0, created_by: assignee, first_response_at: nature === 'New' ? null : iso(created), sla_breached: nature === 'New' && rnd() < 0.3 ? 1 : 0, created_at: iso(created), updated_at: iso(created), type: 'enquiry' });
    leadIds.push({ id: lid, nature, assignee, created, customer: c.id, value, item });
    run('INSERT INTO lead_items(lead_id,item_id,item_name,quantity) VALUES(?,?,?,?)', lid, item.id, item.name, 1);
    if (rnd() < 0.25) { const it2 = pick(items); run('INSERT INTO lead_items(lead_id,item_id,item_name,quantity) VALUES(?,?,?,?)', lid, it2.id, it2.name, between(1, 3)); }
    if (nature !== 'New') {
      const n = between(1, 3);
      for (let k = 0; k < n; k++) {
        const fd = addDays(created, k + 1);
        const final = k === n - 1;
        ins('followups', { lead_id: lid, status_id: final && nature === 'Won' ? stWon.id : final && nature === 'Lost' ? lostSt.id : pick(stFollow).id, quality, stage: final ? stage : 'Contacted', description: pick(['Discussed system size and subsidy', 'Shared brochure on WhatsApp', 'Site visit scheduled', 'Customer asked for revised quote', 'Verified electricity bill', 'Decision with family next week']), next_followup: final && !open ? null : next, business_value: value, user_id: assignee, created_at: iso(fd) });
      }
    }
    if (c.level !== 'Customer' && nature === 'Won') run("UPDATE customers SET level='Customer' WHERE id=?", c.id);
  }

  // ---- quotations
  let qn = 0;
  for (const l of leadIds.filter((x) => x.nature !== 'New').slice(0, 34)) {
    qn++;
    const status = l.nature === 'Won' ? 'Won' : l.nature === 'Lost' ? 'Lost' : pick(['Sent', 'Sent', 'Draft', 'Expired']);
    const d = addDays(l.created, 2), gross = l.value, disc = Math.round(gross * pick([0, 0, 0.02, 0.05]));
    const qid = ins('quotations', { number: `Q-${String(qn).padStart(4, '0')}`, lead_id: l.id, customer_id: l.customer, executive_id: l.assignee, source_id: null, date: ymd(d), valid_upto: ymd(addDays(d, status === 'Expired' ? 10 : 30)), subject: `Proposal for ${l.item.name}`, terms: DEFAULTS.quotation.terms, payment_term_id: pick([ptAdv, ptNet, ptFull]), discount_amt: disc, gross, total: gross - disc, status, created_at: iso(d) });
    run('INSERT INTO quotation_items(quotation_id,item_id,name,rate,qty) VALUES(?,?,?,?,?)', qid, l.item.id, l.item.name, gross, 1);
  }

  // ---- targets, expenses, commission
  const year = today.getFullYear();
  for (const u of [priya, rahul, anita, vikram]) for (let m = 1; m <= 12; m++) { run('INSERT INTO sales_targets(tenant_id,year,type,user_id,month,value) VALUES(?,?,?,?,?,?)', t, year, 'Amount', u, m, u === priya ? 1500000 : 900000); run('INSERT INTO sales_targets(tenant_id,year,type,user_id,month,value) VALUES(?,?,?,?,?,?)', t, year, 'Won Leads Count', u, m, 3); }
  for (let d = 0; d < 45; d += 3) for (const s of ['Google Ads', 'Facebook', 'Instagram']) ins('lead_expenses', { date: ymd(addDays(today, -d)), source_id: src[s], branch_id: b1, amount: between(900, 4200), description: `${s} campaign spend`, campaign: pick(['Rooftop Diwali Offer', 'PM Surya Ghar Subsidy', 'Commercial Solar']), origin: s === 'Google Ads' ? 'manual' : 'meta' });
  ins('commission_payments', { source_id: src.Referral, date: ymd(addDays(today, -12)), amount: 5000, tds: 500, note: 'Q3 referral payout' });

  // ---- tasks
  const types = ['Call', 'Online Meeting', 'Offline Meeting', 'Activities'];
  const taskTitles = ['Call about site survey', 'Share revised quotation', 'Site visit - roof measurement', 'Net-metering paperwork', 'Demo on solar savings calculator', 'Follow up on advance payment', 'Dispatch checklist review'];
  for (let i = 0; i < 28; i++) {
    const host = pick([admin, ...execs]), lead = pick(leadIds), when = new Date(addDays(today, between(-4, 8)).setHours(between(9, 17), pick([0, 30])));
    const done = when < today && rnd() < 0.5;
    const tid = ins('tasks', { type: pick(types), priority: pick(['Normal', 'Normal', 'Medium', 'High']), title: pick(taskTitles), mode: 'later', status: done ? 'done' : 'pending', scheduled_at: rnd() < 0.08 ? null : local(when), started_at: done ? iso(when) : null, ended_at: done ? iso(new Date(when.getTime() + between(10, 90) * 60000)) : null, host_id: host, party_id: lead.customer, lead_id: lead.id, checklist: JSON.stringify(rnd() < 0.3 ? [{ text: 'Carry brochure', done: done }, { text: 'Collect electricity bill', done: done }] : []), created_by: pick([admin, priya]), seconds_worked: done ? between(600, 5400) : 0, created_at: iso(addDays(when, -2)) });
    run('INSERT INTO task_participants VALUES(?,?,?)', tid, host, 'Host');
  }
  ins('predefined_tasks', { name: 'Rooftop installation checklist', task_type: 'Activities', description: 'Standard installation workflow', checklist: JSON.stringify([{ text: 'Structure erection', done: false }, { text: 'Panel mounting', done: false }, { text: 'Inverter + wiring', done: false }, { text: 'Commissioning', done: false }]) });
  ins('predefined_tasks', { name: 'Post-sale feedback call', task_type: 'Call', description: 'Call the customer 7 days after commissioning', checklist: '[]' });

  // ---- automation
  const tpl1 = ins('email_templates', { name: 'Welcome enquiry', subject: 'Thanks for your interest in solar', body: 'Hi {{customer}}, thank you for reaching out. Our executive will call you shortly.' });
  const tpl2 = ins('email_templates', { name: 'Order confirmation', subject: 'Welcome aboard, {{customer}}', body: 'Congratulations on going solar! Your project manager will contact you.' });
  const a1 = ins('automations', { trigger_on: 'New Enquiry', medium: 'Email', template_id: tpl1, trigger_at: 'Immediately', send_to: 'Customer' });
  const a2 = ins('automations', { trigger_on: 'Lead Won', medium: 'Email', template_id: tpl2, trigger_at: 'Immediately', send_to: 'Customer' });
  for (const l of leadIds.slice(0, 18)) ins('automation_logs', { automation_id: pick([a1, a2]), lead_id: l.id, medium: 'Email', status: rnd() < 0.8 ? 'Sent' : 'Failed', reason: '', created_at: iso(l.created) });

  // ---- customisation
  ins('custom_fields', { entity: 'Lead', name: 'Roof type', field_type: 'dropdown', section: 'Site details', sort: 1, options: 'RCC,Metal sheet,Tile' });
  ins('custom_fields', { entity: 'Lead', name: 'Monthly electricity bill', field_type: 'number', section: 'Site details', sort: 2 });
  ins('custom_fields', { entity: 'Customer Profile', name: 'GSTIN', field_type: 'text', section: 'Tax', sort: 1 });
  ins('field_tags', { tag: '{{customer_name}}', field: 'Customer display name' });
  ins('custom_reports', { name: 'Hot leads by source', entity: 'leads', columns: JSON.stringify(['number', 'customer', 'source', 'nature', 'business_value']), filters: '{}' });

  // ---- misc: holidays, leaves, attendance, locations, calls, notifications, billing
  ins('holidays', { date: ymd(addDays(today, 9)), name: 'Local festival' }); ins('holidays', { date: `${year}-12-25`, name: 'Christmas' });
  ins('leaves', { user_id: anita, from_date: ymd(addDays(today, 2)), to_date: ymd(addDays(today, 3)), kind: 'Casual', status: 'Approved' });
  for (let d = 0; d < 20; d++) for (const u of [admin, ...execs]) { if (rnd() < 0.15) continue; const day = addDays(today, -d); const ci = new Date(day.setHours(9, between(0, 40))); ins('attendance', { user_id: u, date: ymd(ci), check_in: iso(ci), check_out: d === 0 ? null : iso(new Date(ci.getTime() + between(7, 9) * 3600000)) }); }
  run('INSERT INTO user_locations VALUES(?,?,?,?,?)', rahul, t, 9.9312, 76.2673, now()); run('INSERT INTO user_locations VALUES(?,?,?,?,?)', anita, t, 10.0159, 76.3419, now());
  for (const l of leadIds.filter((x) => x.nature !== 'New').slice(0, 10)) { const sc = between(40, 95); ins('call_analyses', { date: iso(addDays(l.created, 1)), agent_id: l.assignee, lead_id: l.id, customer_id: l.customer, sentiment: sc > 70 ? 'Positive' : sc > 50 ? 'Neutral' : 'Negative', score: sc, summary: pick(['Customer keen on 5 kW system, asked for subsidy details.', 'Price objection; wants EMI.', 'Agent explained net metering clearly.', 'Customer comparing competitors.']), status: 'Analysed' }); }
  ins('token_usage', { feature: 'AI Call Analysis', operation: 'Seed analysis', tokens: 4200, user_id: admin, created_at: now() });
  ins('invoices', { no: 940, date: ymd(today), period: `${ymd(today)} – ${ymd(addDays(today, 6))}`, due: ymd(addDays(today, 6)), amount: 0, status: 'Paid' });
  ins('complaints', { subject: 'Need help configuring Meta lead sync', type: 'Query', priority: 'Normal', status: 'Open', details: 'Facebook page is connected but leads do not appear.', raised_by: admin, created_at: now() });
  for (const uid of [admin, rahul, anita]) { ins('notifications', { user_id: uid, title: 'Welcome to Orbit CRM', body: 'Take a look at the CRM dashboard and your task board.', kind: 'info', link: '/', created_at: now() }); }
  ins('notifications', { user_id: admin, title: 'SLA breached', body: 'Two new enquiries have had no follow-up for over an hour.', kind: 'sla', link: '/leads?tab=new', created_at: now() });
  ins('mail', { from_id: priya, to_id: admin, subject: 'Weekly pipeline summary', body: 'Hi Arjun,\n\nPipeline looks healthy: 6 hot leads, 2 proposals awaiting decision. I will send the revised target split on Friday.\n\nPriya', created_at: now() });
  const th = ins('chat_threads', { name: 'Sales floor', is_group: 1, created_at: now() });
  for (const u of [admin, priya, rahul, anita, vikram]) run('INSERT INTO chat_members VALUES(?,?,0)', th, u);
  for (const [u, text] of [[priya, 'Good morning team! Targets are live under CRM → Sales Targets.'], [rahul, 'Site visit at Thrissur done, sending photos.'], [anita, 'Two new walk-ins today, assigning to myself.']]) run('INSERT INTO chat_messages(thread_id,user_id,text,created_at) VALUES(?,?,?,?)', th, u, text, now());
  run('INSERT INTO audit_log(tenant_id,user_id,action,entity,record_id,label,created_at) VALUES(?,?,?,?,?,?,?)', t, admin, 'Added', 'lead', 1, 'Enquiry #1', now());
  return { tenant: t };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedAll();
  console.log('Seeded demo tenant. Login → company: DEMO · admin / admin123 (also priya, rahul, anita, vikram / demo123)');
}
