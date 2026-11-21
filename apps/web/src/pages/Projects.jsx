import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Wand2, Check, FolderKanban, Save, Trash2, X, LayoutGrid, List as ListIcon, Flag, Users, Layers, Wallet, Activity } from 'lucide-react';
import { api, compact, dateFmt, ymd } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHead, Card, Badge, Stat, Tabs, SearchBox, Avatar, Bar, Input, Select, Textarea, Switch, Confirm, Loading, Spinner, Empty, useFetch, useAction, useToast } from '../ui/kit.jsx';
import ProjectTree, { LV0, addDays, clone, doneWeight, find, flat, leaves, scaleNodes, span, total, weight } from '../ui/ProjectTree.jsx';
import CostPanel from '../ui/CostPanel.jsx';
import { applySize, autoSchedule, estimate } from '../ui/costing.js';
import { CATS, STATUSES, PRIORITIES, catIcon, catGrad } from './ProjectTemplates.jsx';

const TONE = { Active: 'good', Planning: 'info', 'At Risk': 'bad', 'On Hold': 'warn', Completed: '' };
const PTONE = { Critical: 'bad', High: 'warn', Medium: 'info', Low: '' };
const StatusBadge = ({ s }) => <Badge kind={TONE[s] || ''}>{s}</Badge>;
const PrioDot = ({ p }) => <span className="pm-prio"><i className={`p-${p}`} />{p}</span>;
const Tile = ({ cat, size = 38 }) => { const Ic = catIcon(cat); return <span className="pm-tile lg" style={{ background: catGrad(cat), width: size, height: size }}><Ic size={size * 0.5} /></span>; };

// ---------- project dashboard ----------
function ProjectCard({ p, onClick }) {
  return (
    <div className="card pm-pcard" onClick={onClick}>
      <div className="row between"><span className="pm-code">{p.code}</span><StatusBadge s={p.status} /></div>
      <div className="row" style={{ gap: 12 }}><Tile cat={p.category} /><div className="grow"><h3 className="truncate">{p.name}</h3><div className="small muted truncate">{p.client || 'Internal'} · {p.category}</div></div></div>
      <div><div className="row between small" style={{ marginBottom: 6 }}><span className="muted">Progress</span><b>{p.progress}%</b></div><Bar pct={p.progress} color={p.status === 'Completed' ? 'var(--good)' : p.status === 'At Risk' ? 'var(--warn)' : undefined} /></div>
      <div className="row between small"><PrioDot p={p.priority} /><span className="muted">{dateFmt(p.start_date)} → {dateFmt(p.end_date)}</span></div>
      <div className="row between"><div className="pm-avs">{[p.manager, ...p.members.map((m) => m.name)].filter(Boolean).slice(0, 4).map((n, i) => <Avatar key={i} name={n} size="sm" />)}</div><b>{compact(p.budget)}</b></div>
    </div>
  );
}

export function ProjectList() {
  const nav = useNavigate(); const { can } = useAuth(); const d = useFetch('/pm/projects');
  const [q, setQ] = useState(''); const [st, setSt] = useState(''); const [cat, setCat] = useState(''); const [sort, setSort] = useState('recent'); const [view, setView] = useState('cards');
  const list = useMemo(() => {
    const s = (d.data || []).filter((p) => (!st || p.status === st) && (!cat || p.category === cat) && `${p.name} ${p.code} ${p.client}`.toLowerCase().includes(q.toLowerCase()));
    const by = { recent: (a, b) => (b.start_date || '').localeCompare(a.start_date || ''), name: (a, b) => a.name.localeCompare(b.name), budget: (a, b) => b.budget - a.budget, progress: (a, b) => b.progress - a.progress, priority: (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) };
    return s.sort(by[sort]);
  }, [d.data, q, st, cat, sort]);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const all = d.data;
  return (
    <div className="page">
      <PageHead title="Projects" sub="Structured, component-based projects across every business unit.">
        <button className="btn" onClick={() => nav('/project-templates')}>Templates</button>
        {can('project_management', 'add') && <button className="btn primary" onClick={() => nav('/projects/new')}><Plus size={15} />New project</button>}
      </PageHead>
      <div className="grid g4 mb">
        <Stat icon={FolderKanban} label="Total projects" value={all.length} sub={`${all.filter((p) => p.template_id).length} built from templates`} />
        <Stat icon={Activity} tone="good" label="Active" value={all.filter((p) => p.status === 'Active').length} sub="in delivery now" />
        <Stat icon={Flag} tone="bad" label="At risk" value={all.filter((p) => p.status === 'At Risk').length} sub="need attention" />
        <Stat icon={Wallet} label="Portfolio budget" value={compact(all.reduce((s, p) => s + p.budget, 0))} sub={`${all.reduce((s, p) => s + p.node_count, 0)} structure items`} />
      </div>
      <div className="row wrap mb">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, code or client…" />
        <select className="input" style={{ width: 'auto' }} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{[...new Set([...CATS, ...all.map((p) => p.category)])].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>{[['recent', 'Newest start'], ['name', 'Name'], ['budget', 'Budget'], ['progress', 'Progress'], ['priority', 'Priority']].map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
        <span className="grow" />
        <div className="tabs"><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><LayoutGrid size={14} />Cards</button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><ListIcon size={14} />Table</button></div>
      </div>
      {!list.length ? <Empty icon={FolderKanban} title="No projects match" sub="Try clearing the filters, or create a new project." /> : view === 'cards'
        ? <div className="pm-grid">{list.map((p) => <ProjectCard key={p.id} p={p} onClick={() => nav(`/projects/${p.id}`)} />)}</div>
        : <Card flush><table className="t"><thead><tr><th>Project</th><th>Status</th><th>Priority</th><th>Manager</th><th>Timeline</th><th style={{ width: 150 }}>Progress</th><th className="right">Budget</th></tr></thead>
          <tbody>{list.map((p) => <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/projects/${p.id}`)}><td><b>{p.name}</b><div className="pm-code">{p.code} · {p.category}</div></td><td><StatusBadge s={p.status} /></td><td><PrioDot p={p.priority} /></td><td>{p.manager}</td><td className="small">{dateFmt(p.start_date)} → {dateFmt(p.end_date)}</td><td><Bar pct={p.progress} /></td><td className="right"><b>{compact(p.budget)}</b></td></tr>)}</tbody></table></Card>}
    </div>
  );
}

// ---------- creation wizard ----------
const STEPS = ['Basics', 'Structure source', 'Customize structure', 'Team & budget', 'Review'];
export function ProjectWizard() {
  const nav = useNavigate(); const { user } = useAuth(); const run = useAction(); const toast = useToast(); const [sp] = useSearchParams();
  const tpls = useFetch('/pm/templates'); const people = useFetch('/pm/people'); const clients = useFetch('/pm/clients');
  const [step, setStep] = useState(0); const [saving, setSaving] = useState(false);
  const [w, setW] = useState({ name: '', code: '', description: '', client: '', category: 'Software', manager_id: user.id, status: 'Planning', priority: 'Medium', budget: 100000, start_date: ymd(), end_date: addDays(ymd(), 90), endAuto: true, source: null, template_id: null, levels: [...LV0], resources: [], params: {}, nodes: [], seats: {} });
  const [tplFull, setTplFull] = useState(null);
  const set = (k, v) => setW((x) => ({ ...x, [k]: v }));
  const withEnd = (x) => (x.endAuto && x.nodes.length ? { ...x, end_date: addDays(x.start_date, total(x.nodes)) } : x);
  const setNodes = (nodes) => setW((x) => withEnd({ ...x, nodes }));
  const sizedBudget = (x) => (x.params?.size && x.nodes.length ? { ...x, budget: Math.round(estimate(x.nodes, x.params.size, x.params).total / 1000) * 1000 } : x);
  const resize = (v) => setW((x) => { const nodes = clone(x.nodes); applySize(nodes, v); if (x.params.autoSchedule) autoSchedule(nodes); return sizedBudget(withEnd({ ...x, params: { ...x.params, size: v }, nodes })); });
  const reflow = () => setW((x) => { const nodes = clone(x.nodes); applySize(nodes, x.params.size || 1); autoSchedule(nodes); return withEnd({ ...x, nodes }); });
  const pick = async (id) => {
    const t = await run(() => api.get(`/pm/templates/${id}`)); if (!t) return;
    setTplFull(t);
    setW((x) => sizedBudget(withEnd({ ...x, source: 'template', template_id: t.id, nodes: clone(t.nodes), levels: t.levels, resources: t.resources, params: t.params || {}, category: t.category, budget: t.budget, priority: t.priority, status: t.status, seats: {}, endAuto: true })));
  };
  useEffect(() => { const id = sp.get('template'); if (id) pick(id); }, []); // eslint-disable-line
  if (!tpls.data || !people.data) return <div className="page"><Loading d={tpls.err ? tpls : people} /></div>;
  const canNext = step === 0 ? w.name.trim().length > 0 : step === 1 ? (w.source === 'scratch' || (w.source === 'template' && w.template_id)) : true;
  const create = async () => {
    setSaving(true);
    const team = []; w.resources.forEach((r, i) => { for (let k = 0; k < r.qty; k++) { const u = w.seats[`${i}-${k}`]; if (u) team.push({ user_id: +u, role: r.role, alloc: 80 }); } });
    const res = await run(() => api.post('/pm/projects', { ...w, team }), 'Project created');
    setSaving(false); if (res) nav(`/projects/${res.id}?tab=components`);
  };
  const T = total(w.nodes);
  const fl = flat(w.nodes);
  return (
    <div className="page">
      <PageHead crumbs={<><Link to="/projects">Projects</Link> / New</>} title="Create project" sub={`Step ${step + 1} of 5 — ${STEPS[step]}`} />
      <div className="pm-steps">{STEPS.map((s, i) => <div key={s} className={`pm-step ${i === step ? 'on' : i < step ? 'done' : ''}`}><span className="n">{i < step ? '✓' : i + 1}</span>{s}</div>)}</div>

      {step === 0 && <Card><div className="grid g2">
        <Input label="Project name" required value={w.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Orion Data Platform" />
        <Input label="Project code / reference" value={w.code} onChange={(e) => set('code', e.target.value)} placeholder="Auto-generated if blank" />
        <Textarea className="span2" label="Description" value={w.description} onChange={(e) => set('description', e.target.value)} placeholder="Goals, scope and context…" />
        <div className="field"><label>Client / customer</label><input className="input" list="pm-clients" value={w.client} onChange={(e) => set('client', e.target.value)} placeholder="Company or internal department" /><datalist id="pm-clients">{(clients.data || []).map((c) => <option key={c} value={c} />)}</datalist></div>
        <div className="field"><label>Category / type</label><input className="input" list="pm-cats" value={w.category} onChange={(e) => set('category', e.target.value)} /><datalist id="pm-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist></div>
        <Select label="Project manager" value={w.manager_id} onChange={(e) => set('manager_id', +e.target.value)} options={people.data.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Priority" value={w.priority} onChange={(e) => set('priority', e.target.value)} options={PRIORITIES} />
        <Input label="Start date" type="date" value={w.start_date} onChange={(e) => setW((x) => withEnd({ ...x, start_date: e.target.value }))} />
        <Input label="End date" type="date" value={w.end_date} onChange={(e) => setW((x) => ({ ...x, end_date: e.target.value, endAuto: false }))} />
        <Select label="Status" value={w.status} onChange={(e) => set('status', e.target.value)} options={STATUSES} />
        <Input label="Budget / estimated cost (₹)" type="number" value={w.budget} onChange={(e) => set('budget', +e.target.value)} />
      </div></Card>}

      {step === 1 && <>
        <div className="grid g2 mb">
          <div className={`pm-opt ${w.source === 'scratch' ? 'on' : ''}`} onClick={() => setW((x) => ({ ...x, source: 'scratch', template_id: null, nodes: [], levels: [...LV0], resources: [], params: {}, seats: {} }))}><span className="pm-tile lg" style={{ background: '#475569' }}><Plus size={18} /></span><div><h3>Create from scratch</h3><div className="small muted">Start with an empty structure and build phases, modules and components by hand.</div></div></div>
          <div className={`pm-opt ${w.source === 'template' ? 'on' : ''}`} onClick={() => set('source', 'template')}><span className="pm-tile lg" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}><Wand2 size={18} /></span><div><h3>Create from template</h3><div className="small muted">Generate the complete hierarchy, timeline and resource plan from a saved template.</div></div></div>
        </div>
        {w.source === 'template' && <>
          <h3 className="mb">Choose a template</h3>
          <div className="pm-pick mb">{tpls.data.map((t) => <div key={t.id} className={`pm-pk ${w.template_id === t.id ? 'on' : ''}`} onClick={() => pick(t.id)}><Tile cat={t.category} /><div><b>{t.name}</b><div className="small muted">{t.stats.items} items · {t.stats.days} days</div></div></div>)}</div>
          {tplFull && w.params.size ? <Card className="mb" title="System size"><div className="grid g3"><Input label={`System size (${w.params.unit})`} type="number" min="0.5" step="any" value={w.params.size} onChange={(e) => resize(+e.target.value || 0)} hint="Quantities, man-days, crew durations, schedule and the estimated cost recalculate from this." /><div className="field"><label>Estimated total</label><div className="input" style={{ background: 'var(--line-2)' }}><b>{compact(estimate(w.nodes, w.params.size, w.params).total)}</b></div></div><div className="field"><label>Schedule</label><div className="input" style={{ background: 'var(--line-2)' }}>{total(w.nodes)} days</div></div></div></Card> : null}
          {tplFull && <><h3 className="mb">Preview — {tplFull.name}</h3><ProjectTree nodes={tplFull.nodes} levels={tplFull.levels} readOnly onChange={() => {}} /></>}
        </>}
        {w.source === 'scratch' && <Card><Empty icon={Layers} title="Empty project structure" sub="You'll add phases and components in the next step. Levels default to Phase › Module › Component › Sub-component." /></Card>}
      </>}

      {step === 2 && <>
        <div className="pm-sum"><b>{fl.length} items</b><span>spans <b>{T} days</b></span><span>projected end <b>{dateFmt(addDays(w.start_date, T))}</b></span><span className="grow" />
          <span className="muted">Scale timeline</span><button className="btn sm" onClick={() => setNodes(scaleNodes(w.nodes, 0.9))}>−10%</button><button className="btn sm" onClick={() => setNodes(scaleNodes(w.nodes, 1.1))}>+10%</button>
          {w.params.autoSchedule && <button className="btn sm" title="Re-flow start dates from dependencies and crew-based durations" onClick={reflow}>Auto-schedule</button>}<button className="btn sm" onClick={() => setW((x) => ({ ...x, end_date: addDays(x.start_date, total(x.nodes)), endAuto: true }))}>Align end date</button></div>
        <ProjectTree nodes={w.nodes} levels={w.levels} base={w.start_date} size={w.params.size || 1} unit={w.params.unit || 'unit'} onChange={(n) => setW((x) => sizedBudget(withEnd({ ...x, nodes: n })))} />
      </>}

      {step === 3 && <div className="pm-cols">
        <Card title="Assign team"><div className="small muted mb">{w.template_id ? 'Required roles come from the template. Pick a person for each seat.' : 'No template resource plan — add members from the Team tab after creation.'}</div>
          <div className="col">{w.resources.flatMap((r, i) => Array.from({ length: r.qty }, (_, k) => (
            <div className="row" key={`${i}-${k}`}><span className="pm-chip" style={{ minWidth: 190 }}>{r.role}{r.qty > 1 ? ` #${k + 1}` : ''}</span>
              <select className="input" value={w.seats[`${i}-${k}`] || ''} onChange={(e) => set('seats', { ...w.seats, [`${i}-${k}`]: e.target.value })}><option value="">— Unassigned —</option>{people.data.map((p) => <option key={p.id} value={p.id}>{p.name}{p.designation === r.role ? ' ★' : ''}</option>)}</select></div>)))}</div></Card>
        <Card title="Budget"><Input label="Estimated cost (₹)" type="number" value={w.budget} onChange={(e) => set('budget', +e.target.value)} />
          {w.params.size ? <div className="row mt"><button className="btn sm" onClick={() => set('budget', Math.round(estimate(w.nodes, w.params.size, w.params).total / 1000) * 1000)}>Use estimated cost ({compact(estimate(w.nodes, w.params.size, w.params).total)})</button></div> : null}
          <hr /><div className="small muted">Allocation by {w.levels[0].toLowerCase()} (weighted by duration)</div>
          {w.nodes.map((n) => { const W = leaves(w.nodes).reduce((a, x) => a + weight(x), 0) || 1; const x = leaves([n]).reduce((a, y) => a + weight(y), 0); return <div className="row between small" key={n.id} style={{ padding: '6px 0' }}><span>{n.name}</span><b>{compact(Math.round((w.budget * x) / W))}</b></div>; })}</Card>
      </div>}

      {step === 3 && w.params.size > 0 && <div style={{ marginTop: 16 }}><h3 className="mb">Cost &amp; manpower at {w.params.size} {w.params.unit}</h3><CostPanel nodes={w.nodes} size={w.params.size} unit={w.params.unit} params={w.params} /></div>}

      {step === 4 && <div className="pm-cols">
        <Card title="Summary"><dl className="pm-kv"><dt>Name</dt><dd><b>{w.name}</b></dd><dt>Code</dt><dd>{w.code || 'Auto-generated'}</dd><dt>Client</dt><dd>{w.client || '—'}</dd><dt>Category</dt><dd>{w.category}</dd><dt>Manager</dt><dd>{people.data.find((p) => p.id === w.manager_id)?.name}</dd><dt>Dates</dt><dd>{dateFmt(w.start_date)} → {dateFmt(w.end_date)}</dd><dt>Status / priority</dt><dd>{w.status} · {w.priority}</dd><dt>Budget</dt><dd>{compact(w.budget)}</dd><dt>Source</dt><dd>{tplFull && w.template_id ? `Template: ${tplFull.name}` : 'From scratch'}</dd><dt>Team</dt><dd>{Object.values(w.seats).filter(Boolean).length} assigned</dd></dl></Card>
        <Card title="Generated structure"><div className="row wrap small muted mb" style={{ gap: 14 }}><span><b>{w.nodes.length}</b> {w.levels[0].toLowerCase()}s</span><span><b>{fl.filter((x) => x.n.kind === 'milestone').length}</b> milestones</span><span><b>{fl.filter((x) => x.n.kind === 'deliverable').length}</b> deliverables</span></div>
          {w.nodes.map((n) => <div className="row between small" key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}><span>{n.name}</span><span className="muted">{flat(n.kids).length} items</span></div>)}
          {!w.nodes.length && <div className="muted small">Empty — add components after creation.</div>}</Card>
      </div>}

      <div className="row between" style={{ marginTop: 22 }}>
        <button className="btn" onClick={() => (step ? setStep(step - 1) : nav('/projects'))}>{step ? '← Back' : 'Cancel'}</button>
        {step < 4 ? <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue →</button> : <button className="btn primary" disabled={saving} onClick={create}><Check size={15} />Create project</button>}
      </div>
    </div>
  );
}

// ---------- project detail ----------
const TABS = ['overview', 'components', 'milestones', 'team', 'budget', 'settings'];
export function ProjectDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth(); const run = useAction(); const toast = useToast();
  const [sp, setSp] = useSearchParams(); const tab = TABS.includes(sp.get('tab')) ? sp.get('tab') : 'overview';
  const d = useFetch(`/pm/projects/${id}`); const people = useFetch('/pm/people');
  const [nodes, setNodes] = useState(null); const [dirty, setDirty] = useState(false); const [form, setForm] = useState(null); const [del, setDel] = useState(false); const [add, setAdd] = useState({ user_id: '', role: '' });
  useEffect(() => { if (d.data) { setNodes(clone(d.data.nodes)); setDirty(false); setForm({ name: d.data.name, code: d.data.code, status: d.data.status, priority: d.data.priority, budget: d.data.budget, client: d.data.client, description: d.data.description, settings: d.data.settings }); } }, [d.data]);
  if (!d.data || !nodes || !form) return <div className="page"><Loading d={d} /></div>;
  const p = d.data; const canEdit = can('project_management', 'edit'); const locked = !!p.settings.lock;
  const base = p.start_date || ymd(); const T = Math.max(total(nodes), 1);
  const sz = p.params?.size || 0; const unit = p.params?.unit || 'unit';
  const resize = async (v) => { const n = clone(p.nodes); applySize(n, v); if (p.params.autoSchedule) autoSchedule(n); await run(async () => { await api.put(`/pm/projects/${id}`, { params: { ...p.params, size: v } }); await api.put(`/pm/projects/${id}/structure`, { nodes: n }); d.reload(); }, `Resized to ${v} ${unit}`); };
  const fl = flat(nodes); const ms = fl.filter((x) => x.n.kind === 'milestone'); const dl = fl.filter((x) => x.n.kind === 'deliverable');
  const phasePct = (n) => doneWeight([n]);
  const upcoming = [...ms, ...dl].filter((x) => !x.n.done).sort((a, b) => span(a.n)[1] - span(b.n)[1]).slice(0, 5);
  const saveTeam = (team) => run(async () => { await api.put(`/pm/projects/${id}`, { team }); d.reload(); });
  const teamBody = () => p.team.map((m) => ({ user_id: m.user_id, role: m.role, alloc: m.alloc }));
  return (
    <div className="page">
      <PageHead crumbs={<><Link to="/projects">Projects</Link> / {p.code}</>} title={<span className="row" style={{ gap: 12 }}><Tile cat={p.category} size={44} />{p.name}</span>}
        sub={`${p.client || 'Internal'} · ${p.category}${p.template_name ? ` · from template “${p.template_name}”` : ''}`}>
        <StatusBadge s={p.status} /><PrioDot p={p.priority} />
        {can('project_templates', 'add') && <button className="btn" onClick={() => run(async () => { const r = await api.post(`/pm/projects/${id}/save-as-template`, {}); nav(`/project-templates/${r.id}`); }, 'Saved as template — review and refine it')}><Save size={15} />Save as template</button>}
      </PageHead>
      <div className="mb"><Tabs value={tab} onChange={(t) => setSp({ tab: t })} tabs={TABS.map((t) => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }))} /></div>

      {tab === 'overview' && <>
        <div className="grid g4 mb">
          <Stat icon={Activity} label="Progress" value={`${p.progress}%`} sub="by completed components" />
          <Stat icon={Flag} label="Milestones" value={`${ms.filter((x) => x.n.done).length}/${ms.length}`} sub={`${dl.length} deliverables planned`} tone="good" />
          <Stat icon={Layers} label="Structure" value={fl.length} sub={`${nodes.length} ${p.levels[0].toLowerCase()}s · ${total(nodes)} days`} />
          <Stat icon={Wallet} label="Budget" value={compact(p.budget)} sub={`${dateFmt(p.start_date)} → ${dateFmt(p.end_date)}`} />
        </div>
        <div className="pm-cols">
          <div className="col" style={{ gap: 14 }}>
            <Card title={`${p.levels[0]} progress`}><div className="pm-phases">{nodes.map((n) => <div className="pm-ph" key={n.id}><div className="small b">{n.name}</div><Bar pct={phasePct(n)} color={phasePct(n) === 100 ? 'var(--good)' : undefined} /><div className="small muted">{phasePct(n)}% · {flat(n.kids).length} items</div></div>)}{!nodes.length && <span className="muted">No phases yet.</span>}</div></Card>
            <Card title="Upcoming milestones & deliverables">{upcoming.map(({ n }) => <div className="row between" key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}><span className="row">{n.kind === 'milestone' ? <Flag size={14} color="#f59e0b" /> : <Layers size={14} color="#10b981" />}{n.name}</span><span className="small muted">{dateFmt(addDays(base, span(n)[1]))}</span></div>)}{!upcoming.length && <div className="muted">Everything is complete 🎉</div>}</Card>
          </div>
          <Card title="Details"><dl className="pm-kv"><dt>Description</dt><dd>{p.description || '—'}</dd><dt>Client</dt><dd>{p.client || '—'}</dd><dt>Manager</dt><dd>{p.manager}</dd><dt>Start</dt><dd>{dateFmt(p.start_date)}</dd><dt>End</dt><dd>{dateFmt(p.end_date)}</dd><dt>Hierarchy</dt><dd>{p.levels.join(' › ')}</dd></dl></Card>
        </div></>}

      {tab === 'components' && <>
        {canEdit && !locked && p.params?.autoSchedule && <div className="row mb"><button className="btn sm" onClick={() => { const n = clone(nodes); applySize(n, sz || 1); autoSchedule(n); setNodes(n); setDirty(true); }}>Auto-schedule from dependencies</button><span className="small muted">Re-flows start dates from predecessors and crew-based durations.</span></div>}
        {dirty && <div className="pm-savebar"><span>You have unsaved structure changes.</span><span className="grow" /><button className="btn sm" onClick={() => { setNodes(clone(p.nodes)); setDirty(false); }}>Discard</button>
          <button className="btn sm primary" onClick={() => run(async () => { await api.put(`/pm/projects/${id}/structure`, { nodes }); d.reload(); }, 'Structure saved')}>Save changes</button></div>}
        <ProjectTree nodes={nodes} levels={p.levels} base={base} size={sz || 1} unit={unit} showDone readOnly={!canEdit} locked={locked} footerHint="tick leaf items as they complete · drag to re-arrange" onChange={(n) => { setNodes(n); setDirty(true); }} />
      </>}

      {tab === 'milestones' && <Card flush><table className="t"><thead><tr><th>Item</th><th>Type</th><th>Belongs to</th><th>Due</th><th>Depends on</th><th>Status</th></tr></thead><tbody>
        {[...ms, ...dl].sort((a, b) => span(a.n)[1] - span(b.n)[1]).map(({ n }) => { const par = find(nodes, n.id).par; return <tr key={n.id}><td><b>{n.name}</b></td><td className="muted">{n.kind}</td><td className="muted">{par?.name || '—'}</td><td>{dateFmt(addDays(base, span(n)[1]))}</td><td className="small">{n.dep.map((x) => find(nodes, x)?.n.name).filter(Boolean).join(', ') || '—'}</td><td>{n.done ? <Badge kind="good">Achieved</Badge> : <Badge>Upcoming</Badge>}</td></tr>; })}
        {!ms.length && !dl.length && <tr><td colSpan="6" className="empty">No milestones or deliverables yet.</td></tr>}</tbody></table></Card>}

      {tab === 'team' && <div className="pm-cols">
        <Card title={`Team (${p.team.length + 1})`}>
          <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}><span className="row"><Avatar name={p.manager} size="lg" /><div><b>{p.manager}</b><div className="small muted">Project Manager</div></div></span><Badge kind="brand">Manager</Badge></div>
          {p.team.map((m) => <div className="row between" key={m.user_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}><span className="row"><Avatar name={m.name} size="lg" /><div><b>{m.name}</b><div className="small muted">{m.role || 'Member'}</div></div></span>
            <span className="row" style={{ width: 210 }}><span className="grow"><Bar pct={m.alloc} /></span><span className="small">{m.alloc}%</span>{canEdit && <button className="icon-btn" onClick={() => saveTeam(teamBody().filter((x) => x.user_id !== m.user_id))}><X size={14} /></button>}</span></div>)}
          {canEdit && <div className="row mt"><select className="input" value={add.user_id} onChange={(e) => setAdd({ ...add, user_id: e.target.value })}><option value="">Add a member…</option>{(people.data || []).filter((u) => u.id !== p.manager_id && !p.team.some((m) => m.user_id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <input className="input" placeholder="Role" value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })} /><button className="btn" disabled={!add.user_id} onClick={async () => { await saveTeam([...teamBody(), { user_id: +add.user_id, role: add.role, alloc: 60 }]); setAdd({ user_id: '', role: '' }); }}><Plus size={14} />Add</button></div>}
        </Card>
        <Card title="Resource plan"><div className="small muted mb">Required resources from the template, matched against assigned roles.</div>
          {p.resources.map((r) => { const have = p.team.filter((m) => m.role === r.role).length; return <div className="row between small" key={r.role} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}><span>{r.role}</span><Badge kind={have >= r.qty ? 'good' : 'warn'}>{have}/{r.qty}</Badge></div>; })}
          {!p.resources.length && <div className="muted small">No resource plan.</div>}</Card>
      </div>}

      {tab === 'budget' && (() => { const W = leaves(nodes).reduce((a, x) => a + weight(x), 0) || 1; const earned = Math.round((p.budget * p.progress) / 100); return <>
        <div className="grid g3 mb"><Stat icon={Wallet} label="Total budget" value={compact(p.budget)} /><Stat icon={Activity} tone="good" label="Earned value" value={compact(earned)} sub={`${p.progress}% of scope complete`} /><Stat icon={Layers} label="Remaining scope value" value={compact(p.budget - earned)} /></div>
        {sz > 0 && <div className="mb"><CostPanel nodes={nodes} size={sz} unit={unit} params={p.params} /></div>}
        {!sz && <Card flush><table className="t"><thead><tr><th>{p.levels[0]}</th><th>Planned allocation</th><th style={{ width: '34%' }}>Completion</th><th className="right">Earned</th></tr></thead><tbody>
          {nodes.map((n) => { const w = leaves([n]).reduce((a, x) => a + weight(x), 0); const al = Math.round((p.budget * w) / W); const pc = phasePct(n); return <tr key={n.id}><td><b>{n.name}</b></td><td>{compact(al)} <span className="muted small">({Math.round((w / W) * 100)}%)</span></td><td><Bar pct={pc} /></td><td className="right">{compact(Math.round((al * pc) / 100))}</td></tr>; })}</tbody></table></Card>}
        {!sz && <p className="small muted">Allocation is weighted by planned duration. Earned value follows completed components; actual spend will come from the finance module.</p>}</>; })()}

      {tab === 'settings' && <div className="pm-cols">
        <Card title="General"><div className="grid g2">
          <Input label="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input label="Project code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} /><Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={PRIORITIES} />
          {sz > 0 && <Input label={`System size (${unit})`} type="number" min="0.5" step="any" value={form.size ?? sz} onChange={(e) => setForm({ ...form, size: +e.target.value })} hint="Use “Resize” below to recalculate quantities, durations and schedule." />}
          <Input label="Budget (₹)" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: +e.target.value })} /><Input label="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          <Textarea className="span2" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {canEdit && <div className="row mt"><button className="btn primary" onClick={() => run(async () => { await api.put(`/pm/projects/${id}`, form); d.reload(); }, 'Settings saved')}><Check size={15} />Save settings</button>{sz > 0 && form.size && form.size !== sz && <button className="btn" onClick={() => resize(form.size)}>Resize to {form.size} {unit}</button>}</div>}</Card>
        <div className="col" style={{ gap: 14 }}>
          <Card title="Structure rules"><div className="row between"><div><b>Lock structure</b><div className="small muted">Prevent changes to phases and modules after kickoff.</div></div><Switch checked={form.settings.lock} disabled={!canEdit} onChange={async (v) => { setForm({ ...form, settings: { ...form.settings, lock: v } }); await run(async () => { await api.put(`/pm/projects/${id}`, { settings: { ...form.settings, lock: v } }); d.reload(); }, v ? 'Structure locked' : 'Structure unlocked'); }} /></div></Card>
          {can('project_management', 'delete') && <Card title="Danger zone"><button className="btn danger" onClick={() => setDel(true)}><Trash2 size={15} />Delete project</button></Card>}
        </div>
      </div>}
      {del && <Confirm danger title="Delete project?" message="This permanently removes the project and its component structure." confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={() => run(async () => { await api.del(`/pm/projects/${id}`); nav('/projects'); }, 'Project deleted')} />}
    </div>
  );
}
