import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Sun, ShieldCheck, Code2, Building2, Megaphone, Layers, Home, FolderKanban, Eye, Pencil, Copy, Star, Trash2, Wand2, X, Check } from 'lucide-react';
import { api, compact } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHead, Card, Input, Select, Textarea, Check as CheckBox, Modal, Confirm, Spinner, Loading, useFetch, useAction, useToast } from '../ui/kit.jsx';
import ProjectTree, { LV0 } from '../ui/ProjectTree.jsx';
import CostPanel from '../ui/CostPanel.jsx';
import { applySize, autoSchedule } from '../ui/costing.js';

export const CATS = ['Solar', 'Security', 'Software', 'Construction', 'Marketing', 'Implementation', 'Internal'];
const CAT = { Solar: [Sun, '#f59e0b,#ea580c'], Security: [ShieldCheck, '#0f766e,#0891b2'], Software: [Code2, '#4f46e5,#7c3aed'], Construction: [Building2, '#d97706,#ea580c'], Marketing: [Megaphone, '#db2777,#f43f5e'], Implementation: [Layers, '#0891b2,#2563eb'], Internal: [Home, '#059669,#0d9488'] };
export const catIcon = (c) => (CAT[c] || [FolderKanban])[0];
export const catGrad = (c) => `linear-gradient(135deg, ${(CAT[c] || ['', '#475569,#64748b'])[1]})`;
export const STATUSES = ['Planning', 'Active', 'At Risk', 'On Hold', 'Completed'];
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

function TemplateCard({ t, can, onUse, onPrev, onDup, onDef, onDel, nav }) {
  const Ic = catIcon(t.category); const T = Math.max(...t.nodes.map((n) => n.span[1]), 1);
  return (
    <div className="card pm-tcard">
      <div className="pm-thead" style={{ background: catGrad(t.category) }}>
        <Ic className="pm-bigico" size={110} strokeWidth={1.2} />
        <span className="pm-glass">{t.category}</span>{t.is_default && <span title="Default for its category" style={{ float: 'right', color: '#fde68a' }}><Star size={16} fill="currentColor" /></span>}
        <h3>{t.name}</h3>
      </div>
      <div className="card-b col" style={{ flex: 1, gap: 12 }}>
        <div className="small muted" style={{ minHeight: 36 }}>{t.description}</div>
        <div className="pm-mini">{t.nodes.map((n, i) => <div key={i} title={n.name}><i style={{ left: `${(n.span[0] / T) * 100}%`, width: `${((n.span[1] - n.span[0]) / T) * 100}%`, background: catGrad(t.category) }} /></div>)}</div>
        <div className="row wrap small muted" style={{ gap: 14 }}><span><b>{t.stats.phases}</b> {(t.levels[0] || 'phase').toLowerCase()}s</span><span><b>{t.stats.items}</b> items</span><span><b>{t.stats.days}</b> days</span><span>used <b>{t.uses}×</b></span>{t.stats.estimate ? <span>est. <b>{compact(t.stats.estimate)}</b> @ {t.params.size} {t.params.unit}</span> : null}</div>
        <div className="row between" style={{ marginTop: 'auto' }}>
          {can('project_management', 'add') ? <button className="btn sm primary" onClick={() => onUse(t)}><Wand2 size={14} />Use template</button> : <span />}
          <span className="row" style={{ gap: 0 }}>
            <button className="icon-btn" title="Preview" onClick={() => onPrev(t)}><Eye size={15} /></button>
            {can('project_templates', 'edit') && <button className="icon-btn" title="Edit" onClick={() => nav(`/project-templates/${t.id}`)}><Pencil size={15} /></button>}
            {can('project_templates', 'add') && <button className="icon-btn" title="Duplicate" onClick={() => onDup(t)}><Copy size={15} /></button>}
            {can('project_templates', 'edit') && <button className="icon-btn" title={t.is_default ? 'Default' : 'Set as default'} style={t.is_default ? { color: '#f59e0b' } : null} onClick={() => onDef(t)}><Star size={15} /></button>}
            {can('project_templates', 'delete') && <button className="icon-btn" title="Delete" onClick={() => onDel(t)}><Trash2 size={15} /></button>}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TemplateGallery() {
  const nav = useNavigate(); const { can } = useAuth(); const run = useAction();
  const d = useFetch('/pm/templates'); const [cat, setCat] = useState(''); const [prev, setPrev] = useState(null); const [del, setDel] = useState(null);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const cats = [...new Set(d.data.map((t) => t.category))];
  const list = d.data.filter((t) => !cat || t.category === cat);
  const openPrev = async (t) => setPrev({ t, full: await api.get(`/pm/templates/${t.id}`) });
  return (
    <div className="page">
      <PageHead title="Project templates" sub="Reusable structures that generate a complete project hierarchy in one click.">
        {can('project_templates', 'add') && <button className="btn primary" onClick={() => nav('/project-templates/new')}><Plus size={15} />New template</button>}
      </PageHead>
      <div className="chips mb">{['', ...cats].map((c) => <span key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c || 'All'}</span>)}</div>
      <div className="pm-tgrid">
        {list.map((t) => <TemplateCard key={t.id} t={t} can={can} nav={nav} onUse={(x) => nav(`/projects/new?template=${x.id}`)} onPrev={openPrev}
          onDup={(x) => run(async () => { await api.post(`/pm/templates/${x.id}/duplicate`); d.reload(); }, 'Template duplicated')}
          onDef={(x) => run(async () => { await api.post(`/pm/templates/${x.id}/default`); d.reload(); }, `${x.name} is now the default for ${x.category}`)} onDel={setDel} />)}
        {can('project_templates', 'add') && <div className="card pm-newcard" onClick={() => nav('/project-templates/new')}><Plus size={22} /><b>Create a template</b><span className="small muted">Start blank, or define your own hierarchy levels for any industry.</span></div>}
      </div>
      {prev && <Modal size="xl" title={`${prev.t.name} — structure preview`} onClose={() => setPrev(null)}
        footer={<><button className="btn" onClick={() => setPrev(null)}>Close</button>{can('project_management', 'add') && <button className="btn primary" onClick={() => nav(`/projects/new?template=${prev.t.id}`)}>Use this template</button>}</>}>
        <ProjectTree nodes={prev.full.nodes} levels={prev.full.levels} readOnly onChange={() => {}} />
      </Modal>}
      {del && <Confirm danger title="Delete template?" message={`“${del.name}” will be removed. Existing projects built from it keep their structure.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => run(async () => { await api.del(`/pm/templates/${del.id}`); d.reload(); }, 'Template deleted')} />}
    </div>
  );
}

export function TemplateEditor() {
  const { id } = useParams(); const nav = useNavigate(); const run = useAction(); const toast = useToast();
  const [t, setT] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (id) api.get(`/pm/templates/${id}`).then(setT).catch((e) => toast(e.message, 'bad'));
    else setT({ name: '', category: 'Software', description: '', levels: [...LV0], status: 'Planning', priority: 'Medium', budget: 100000, resources: [], is_default: false, params: {}, nodes: [] });
  }, [id]); // eslint-disable-line
  if (!t) return <div className="page"><Spinner /></div>;
  const set = (k, v) => setT((x) => ({ ...x, [k]: v }));
  const P = t.params || {}; const setP = (k, v) => set('params', { ...P, [k]: v });
  const sized = !!P.size;
  const recalc = () => { const n = JSON.parse(JSON.stringify(t.nodes)); applySize(n, P.size || 1); if (P.autoSchedule) autoSchedule(n); set('nodes', n); toast('Durations recalculated from crew sizes' + (P.autoSchedule ? ' and schedule re-flowed' : ''), 'good'); };
  const setRes = (i, k, v) => set('resources', t.resources.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    if (!t.name.trim()) return toast('Give the template a name', 'bad');
    setSaving(true);
    const r = await run(async () => (id ? api.put(`/pm/templates/${id}`, t) : api.post('/pm/templates', t)), 'Template saved');
    setSaving(false); if (r) nav('/project-templates');
  };
  return (
    <div className="page">
      <PageHead crumbs={<><Link to="/project-templates">Templates</Link> / {id ? 'Edit' : 'New'}</>} title={id ? 'Edit template' : 'New template'} sub="Define hierarchy labels, default structure, suggested timeline and required resources.">
        <button className="btn" onClick={() => nav('/project-templates')}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}><Check size={15} />Save template</button>
      </PageHead>
      <div className="pm-cols mb">
        <Card><div className="grid g2">
          <Input label="Template name" required value={t.name} onChange={(e) => set('name', e.target.value)} />
          <div className="field"><label>Category</label><input className="input" list="pm-cats" value={t.category} onChange={(e) => set('category', e.target.value)} /><datalist id="pm-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist></div>
          <Textarea className="span2" label="Description" rows={2} value={t.description || ''} onChange={(e) => set('description', e.target.value)} />
          <div className="field span2"><label>Hierarchy level labels</label><div className="grid g4">{[0, 1, 2, 3].map((i) => <input key={i} className="input" placeholder={`Level ${i + 1}`} value={t.levels[i] || ''} onChange={(e) => set('levels', Object.assign([...t.levels], { [i]: e.target.value }))} />)}</div><span className="hint">Rename levels to fit the industry — e.g. Phase › Work Package › Component › Activity Group.</span></div>
          <Select label="Default status" value={t.status} onChange={(e) => set('status', e.target.value)} options={STATUSES} />
          <Select label="Default priority" value={t.priority} onChange={(e) => set('priority', e.target.value)} options={PRIORITIES} />
          <Input label="Suggested budget" type="number" value={t.budget} onChange={(e) => set('budget', +e.target.value)} />
          <div className="field" style={{ justifyContent: 'end' }}><CheckBox label="Default template for its category" checked={t.is_default} onChange={(v) => set('is_default', v)} /></div>
        </div></Card>
        <Card title="Required resources" actions={<button className="btn sm" onClick={() => set('resources', [...t.resources, { role: 'New role', qty: 1 }])}><Plus size={13} />Add</button>}>
          <div className="col">{t.resources.map((r, i) => <div className="row" key={i}><input className="input" value={r.role} onChange={(e) => setRes(i, 'role', e.target.value)} /><input className="input" type="number" min="1" style={{ width: 74 }} value={r.qty} onChange={(e) => setRes(i, 'qty', Math.max(1, +e.target.value || 1))} /><button className="icon-btn" onClick={() => set('resources', t.resources.filter((_, j) => j !== i))}><X size={14} /></button></div>)}
            {!t.resources.length && <div className="muted small">No resources yet.</div>}</div>
        </Card>
      </div>
      <Card title="Sizing, costing & scheduling" className="mb">
        <div className="small muted mb">Optional. Give the template a size unit (e.g. kWp) to make quantities, man-days and durations scale with project size, and to show a cost estimate.</div>
        <div className="grid g4">
          <Input label="Default size" type="number" min="0" step="any" value={P.size ?? ''} onChange={(e) => setP('size', +e.target.value || 0)} />
          <Input label="Size unit" value={P.unit ?? ''} placeholder="kWp, m², units…" onChange={(e) => setP('unit', e.target.value)} />
          <Input label="Overhead & margin %" type="number" min="0" value={P.overhead ?? ''} onChange={(e) => setP('overhead', +e.target.value || 0)} />
          <div />
          <Input label="GST on materials %" type="number" min="0" value={P.gstGoods ?? ''} onChange={(e) => setP('gstGoods', +e.target.value || 0)} />
          <Input label="GST on services %" type="number" min="0" value={P.gstServices ?? ''} onChange={(e) => setP('gstServices', +e.target.value || 0)} />
          <div className="field" style={{ justifyContent: 'end' }}><CheckBox label="Auto-schedule from dependencies" checked={!!P.autoSchedule} onChange={(v) => setP('autoSchedule', v)} /></div>
          <div className="field" style={{ justifyContent: 'end' }}><CheckBox label="Estimate PM Surya Ghar subsidy" checked={!!P.subsidy} onChange={(v) => setP('subsidy', v ? { label: 'PM Surya Ghar central subsidy (est.)', tiers: [[2, 30000], [1, 18000]] } : undefined)} /></div>
        </div>
        {sized && <div className="row mt"><button className="btn sm" onClick={recalc}>Recalculate durations{P.autoSchedule ? ' & schedule' : ''} for {P.size} {P.unit}</button></div>}
      </Card>
      <ProjectTree nodes={t.nodes} levels={t.levels} size={P.size || 1} unit={P.unit || 'unit'} onChange={(n) => set('nodes', n)} />
      {sized && <div className="mt"><h3 className="mb">Cost &amp; manpower estimate at {P.size} {P.unit}</h3><CostPanel nodes={t.nodes} size={P.size} unit={P.unit} params={P} /></div>}
    </div>
  );
}

