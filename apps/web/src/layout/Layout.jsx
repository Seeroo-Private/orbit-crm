import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, CheckSquare, BarChart3, MessageSquare, FolderKanban, Settings, Bell, Search, Moon, Sun, Languages, LogOut, User, Sparkles, Plus, Link2, Gift, Wallet, X, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api, dateTime } from '../api.js';
import { Avatar, AttendanceConfirm, useFetch, useToast, useAction } from '../ui/kit.jsx';

// Navigation model: one rail item per module, each with its own sub navigation.
export const NAV = [
  { id: 'home', label: 'Home', icon: Home, to: '/', match: (p) => p === '/', sub: [] },
  { id: 'crm', label: 'CRM', icon: Users, to: '/leads', match: (p) => /^\/(leads|followups|customers|quotations|targets|expenses|commissions|call-analysis|enquiry)/.test(p), sub: [
    { to: '/leads', label: 'Leads', perm: 'lead_management' }, { to: '/followups', label: 'Follow-ups', perm: 'lead_management' }, { to: '/customers', label: 'Customers', perm: 'customers' },
    { to: '/quotations', label: 'Quotations', perm: 'lead_management' }, { to: '/targets', label: 'Sales Targets', perm: 'sales_target' }, { to: '/expenses', label: 'Lead Expenses', perm: 'lead_expense' },
    { to: '/commissions', label: 'Commission', perm: 'lead_source_commission' }, { to: '/call-analysis', label: 'Call Analysis', perm: 'call_analysis' } ] },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, to: '/my-tasks', match: (p) => /^\/(my-tasks|task|calendar|todo|team-tasks)/.test(p), sub: [
    { to: '/my-tasks', label: 'My Tasks', perm: 'task_management' }, { to: '/task-dashboard', label: 'Dashboard', perm: 'task_management' }, { to: '/team-tasks', label: 'Team Tasks', perm: 'task_management' },
    { to: '/todo', label: 'To-do', perm: 'task_management' }, { to: '/task-timeline', label: 'Timeline', perm: 'task_management' }, { to: '/calendar', label: 'Calendar', perm: 'calendar' }, { to: '/predefined-tasks', label: 'Predefined', perm: 'predefined_tasks' } ] },
  { id: 'projects', label: 'Projects', icon: FolderKanban, to: '/projects', match: (p) => /^\/(projects|project-templates)/.test(p), sub: [
    { to: '/projects', label: 'Projects', perm: 'project_management' }, { to: '/project-templates', label: 'Templates', perm: 'project_templates' } ] },
  { id: 'insights', label: 'Insights', icon: BarChart3, to: '/dashboard', match: (p) => /^\/(dashboard|reports|executive|forecast|dynamic)/.test(p), sub: [
    { to: '/dashboard', label: 'CRM Dashboard', perm: 'crm_dashboard' }, { to: '/executive', label: 'Executives', perm: 'crm_dashboard' }, { to: '/forecast', label: 'Forecast', perm: 'lead_forecast' }, { to: '/reports', label: 'Reports' } ] },
  { id: 'team', label: 'Team', icon: MessageSquare, to: '/chat', match: (p) => /^\/(chat|mail|assistant|locations|attendance|notifications)/.test(p), sub: [
    { to: '/chat', label: 'Team Chat', perm: 'team_chat' }, { to: '/mail', label: 'Mail' }, { to: '/assistant', label: 'AI Assistant', perm: 'ai_assistant' }, { to: '/attendance', label: 'Attendance' }, { to: '/locations', label: 'Locations', perm: 'user_location' }, { to: '/notifications', label: 'Notifications' } ] },
  { id: 'master', label: 'Admin', icon: Settings, to: '/master', match: (p) => /^\/(master|settings|users|roles|org|import|tokens|billing|audit|support|whats-new|profile)/.test(p), sub: [
    { to: '/master', label: 'Masters' }, { to: '/users', label: 'Users', perm: 'users' }, { to: '/roles', label: 'Access Roles', perm: 'access_role' }, { to: '/settings', label: 'Settings' },
    { to: '/import', label: 'Import', perm: 'upload_management' }, { to: '/tokens', label: 'AI Tokens' }, { to: '/billing', label: 'Billing' }, { to: '/audit', label: 'Audit Log', perm: 'user_log' }, { to: '/support', label: 'Support', perm: 'support_complaints' }, { to: '/whats-new', label: "What's new" } ] },
];

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32"><circle cx="16" cy="16" r="5" fill="#fff" /><ellipse cx="16" cy="16" rx="12" ry="4.8" fill="none" stroke="#ff6b4a" strokeWidth="2.4" transform="rotate(-25 16 16)" /></svg>
  );
}

function Palette({ onClose }) {
  const nav = useNavigate(); const { can } = useAuth();
  const [qv, setQv] = useState(''); const [res, setRes] = useState({}); const [sel, setSel] = useState(0);
  const pages = useMemo(() => NAV.flatMap((n) => n.sub.filter((s) => !s.perm || can(s.perm)).map((s) => ({ label: s.label, to: s.to, grp: n.label }))), [can]);
  useEffect(() => { if (qv.length < 2) return setRes({}); const t = setTimeout(() => api.get('/search', { q: qv }).then(setRes).catch(() => {}), 200); return () => clearTimeout(t); }, [qv]);
  const items = [
    ...pages.filter((p) => !qv || p.label.toLowerCase().includes(qv.toLowerCase())).slice(0, 8).map((p) => ({ g: 'Go to', label: p.label, sub: p.grp, to: p.to })),
    ...(res.leads || []).map((x) => ({ g: 'Leads', label: `#${x.number} · ${x.customer}`, to: `/leads/${x.id}` })),
    ...(res.customers || []).map((x) => ({ g: 'Customers', label: x.display_name, sub: x.phone, to: `/customers/${x.id}` })),
    ...(res.tasks || []).map((x) => ({ g: 'Tasks', label: x.title, to: '/my-tasks' })),
    ...(res.quotations || []).map((x) => ({ g: 'Quotations', label: `${x.number} · ${x.customer}`, to: `/quotations/${x.id}` })),
  ];
  const go = (it) => { nav(it.to); onClose(); };
  let last = '';
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette">
        <input autoFocus placeholder="Search leads, customers, tasks or jump to a page…" value={qv} onChange={(e) => { setQv(e.target.value); setSel(0); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') setSel((s) => Math.min(items.length - 1, s + 1)); if (e.key === 'ArrowUp') setSel((s) => Math.max(0, s - 1)); if (e.key === 'Enter' && items[sel]) go(items[sel]); }} />
        <div className="res">
          {items.map((it, i) => { const head = it.g !== last; last = it.g; return <div key={i}>{head && <div className="grp">{it.g}</div>}<div className={`it ${i === sel ? 'sel' : ''}`} onClick={() => go(it)}><span className="grow">{it.label}</span><span className="muted small">{it.sub}</span></div></div>; })}
          {!items.length && <div className="empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}

function NotifMenu({ onClose }) {
  const nav = useNavigate(); const d = useFetch('/notifications');
  return (
    <div className="menu" style={{ width: 340 }}>
      <div className="row between" style={{ padding: '4px 8px 8px' }}><b>Notifications</b><button className="btn sm ghost" onClick={async () => { await api.post('/notifications/read', {}); d.reload(); }}>Mark all read</button></div>
      <div style={{ maxHeight: 340, overflow: 'auto' }}>
        {(d.data || []).slice(0, 12).map((n) => (
          <a key={n.id} href="#" onClick={async (e) => { e.preventDefault(); await api.post('/notifications/read', { id: n.id }); onClose(); nav(n.link || '/notifications'); }} style={{ alignItems: 'flex-start', opacity: n.is_read ? 0.6 : 1 }}>
            <span className="badge brand" style={{ marginTop: 2 }}>{n.kind}</span><span className="grow"><b className="small">{n.title}</b><div className="small muted">{n.body}</div><div className="small muted">{dateTime(n.created_at)}</div></span>
          </a>
        ))}
        {d.data && !d.data.length && <div className="empty">You are all caught up</div>}
      </div>
      <hr /><a href="#" onClick={(e) => { e.preventDefault(); onClose(); nav('/notifications'); }}>See all notifications</a>
    </div>
  );
}

export default function Layout() {
  const { user, logout, theme, setTheme, lang, setLang, can, refresh } = useAuth();
  const loc = useLocation(); const nav = useNavigate(); const run = useAction(); const toast = useToast();
  const [pal, setPal] = useState(false); const [menu, setMenu] = useState(null); const [attDlg, setAttDlg] = useState(false);
  const badges = useFetch('/badges'); const att = useFetch('/attendance/today');
  const links = useFetch('/my-quick-links');
  const wrap = useRef();
  const active = NAV.find((n) => n.match(loc.pathname)) || NAV[0];

  useEffect(() => { const f = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(true); } }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);
  useEffect(() => { const t = setInterval(badges.reload, 30000); return () => clearInterval(t); }, [badges.reload]);
  useEffect(() => { const f = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setMenu(null); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  // share location while signed in (if browser allows)
  useEffect(() => { navigator.geolocation?.getCurrentPosition((p) => api.post('/locations', { lat: p.coords.latitude, lng: p.coords.longitude }).catch(() => {}), () => {}, { timeout: 4000 }); }, []);

  const b = badges.data || {};
  const checked = att.data && !att.data.check_out;
  const toggleOnline = async () => { await api.patch('/auth/me', { is_online: !user.is_online }); await refresh(); toast(user.is_online ? 'You are now offline — no new auto-assigned leads' : 'You are online', 'good'); };

  return (
    <div className="shell">
      <nav className="rail">
        <div className="logo"><Logo /></div>
        {NAV.map((n) => (
          <NavLink key={n.id} to={n.to} className={`ri ${active.id === n.id ? 'active' : ''}`}>
            <n.icon size={20} />{n.label}
            {n.id === 'team' && (b.mail + b.chat > 0) && <span className="dot">{b.mail + b.chat}</span>}
          </NavLink>
        ))}
        <div className="spacer" />
      </nav>
      <div className="main">
        <header className="topbar" ref={wrap}>
          <div className="search-pill" onClick={() => setPal(true)}><Search size={15} /><span className="small">Search anything…</span><kbd>Ctrl K</kbd></div>
          <div className="grow" />
          {can('lead_management', 'add') && <button className="btn primary" onClick={() => nav('/leads/new')}><Plus size={15} />New enquiry</button>}
          {can('task_management', 'add') && <button className="btn" onClick={() => nav('/my-tasks?new=1')}><Plus size={15} />Task</button>}
          <button className="icon-btn" title={checked ? 'Check out' : 'Check in'} onClick={() => setAttDlg(true)} style={checked ? { color: 'var(--good)', borderColor: 'var(--good)' } : null}><Clock size={16} /></button>
          {attDlg && <AttendanceConfirm checkedIn={checked} since={att.data?.check_in} name={user.name} onClose={() => setAttDlg(false)} onConfirm={() => run(async () => { await api.post(checked ? '/attendance/check-out' : '/attendance/check-in'); att.reload(); }, checked ? 'Checked out' : 'Checked in')} />}
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" title="Quick links" onClick={() => setMenu(menu === 'links' ? null : 'links')}><Link2 size={16} /></button>
            {menu === 'links' && <div className="menu"><b className="small muted" style={{ padding: '4px 8px' }}>QUICK LINKS</b>
              {(links.data || []).map((l) => <div key={l.id} className="row"><a className="grow" href="#" onClick={(e) => { e.preventDefault(); setMenu(null); nav(l.path); }}>{l.name}</a><button className="btn sm ghost" onClick={async () => { await api.del(`/my-quick-links/${l.id}`); links.reload(); }}><X size={12} /></button></div>)}
              <hr /><button className="mi" onClick={async () => { await api.post('/my-quick-links', { name: active.sub.find((s) => loc.pathname.startsWith(s.to))?.label || active.label, path: loc.pathname }); links.reload(); toast('Page pinned', 'good'); }}><Plus size={14} />Pin this page</button></div>}
          </div>
          <button className="icon-btn" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button className="icon-btn" title="English / العربية" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Languages size={16} /></button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setMenu(menu === 'n' ? null : 'n')}><Bell size={16} />{b.notifications > 0 && <span className="dot">{b.notifications}</span>}</button>
            {menu === 'n' && <NotifMenu onClose={() => { setMenu(null); badges.reload(); }} />}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="row" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setMenu(menu === 'u' ? null : 'u')}><Avatar name={user.name} /></button>
            {menu === 'u' && (
              <div className="menu">
                <div className="row" style={{ padding: 8 }}><Avatar name={user.name} size="lg" /><div><b>{user.name}</b><div className="small muted">{user.tenant.name} · {user.tenant.code}</div></div></div><hr />
                <a href="#" onClick={(e) => { e.preventDefault(); setMenu(null); nav('/profile'); }}><User size={15} />My profile</a>
                <button className="mi" onClick={() => { setMenu(null); toggleOnline(); }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: user.is_online ? 'var(--good)' : 'var(--muted)' }} />{user.is_online ? 'Online — go offline' : 'Offline — go online'}</button>
                <a href="#" onClick={(e) => { e.preventDefault(); setMenu(null); nav('/tokens'); }}><Sparkles size={15} />AI tokens</a>
                <a href="#" onClick={(e) => { e.preventDefault(); setMenu(null); nav('/whats-new'); }}><Gift size={15} />What’s new</a><hr />
                <button className="mi" onClick={logout}><LogOut size={15} />Sign out</button>
              </div>
            )}
          </div>
        </header>
        {active.sub.length > 0 && (
          <div className="subnav">{active.sub.filter((s) => !s.perm || can(s.perm)).map((s) => <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive || (s.to !== '/' && loc.pathname.startsWith(s.to + '/')) ? 'active' : '')}>{s.label}</NavLink>)}</div>
        )}
        <Outlet />
      </div>
      {pal && <Palette onClose={() => setPal(false)} />}
    </div>
  );
}
