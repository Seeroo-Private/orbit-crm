import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, Save, Sparkles, IndianRupee } from 'lucide-react';
import { api, money, compact, dateFmt, dateTime, ymd } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, useAction, Loading, PageHead, Card, Tabs, Badge, DataTable, Modal, Input, Select, Textarea, Empty, Stat, Field } from '../ui/kit.jsx';
import { GroupedBars, Gauge } from '../ui/charts.jsx';
import { useLookups } from './Leads.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ================= Sales targets =================
export function Targets() {
  const { can } = useAuth(); const run = useAction();
  const [year, setYear] = useState(new Date().getFullYear()); const [type, setType] = useState('Amount');
  const d = useFetch('/targets', { year, type });
  const [grid, setGrid] = useState({}); const [spread, setSpread] = useState({ user: '', total: '' });
  useEffect(() => { if (d.data) { const g = {}; d.data.targets.forEach((t) => { g[`${t.user_id}-${t.month}`] = t.value; }); setGrid(g); } }, [d.data]);
  const ach = useMemo(() => { const m = {}; (d.data?.achieved || []).forEach((a) => { m[`${a.user_id}-${a.month}`] = a.value; }); return m; }, [d.data]);
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const users = d.data.users; const edit = can('sales_target', 'edit');
  const fmt = (v) => (type === 'Amount' ? compact(v) : v);
  const sumT = (m) => users.reduce((a, u) => a + (+grid[`${u.id}-${m}`] || 0), 0);
  const sumA = (m) => users.reduce((a, u) => a + (+ach[`${u.id}-${m}`] || 0), 0);
  const chart = MONTHS.map((n, i) => ({ name: n, target: sumT(i + 1), achieved: sumA(i + 1) }));
  const save = async () => { const values = []; users.forEach((u) => { for (let m = 1; m <= 12; m++) values.push({ user_id: u.id, month: m, value: +grid[`${u.id}-${m}`] || 0 }); }); await run(() => api.put('/targets', { year, type, values }), 'Targets saved'); d.reload(); };
  const doSpread = () => { if (!spread.user || !spread.total) return; const each = Math.round(+spread.total / 12); const g = { ...grid }; for (let m = 1; m <= 12; m++) g[`${spread.user}-${m}`] = each; setGrid(g); };
  const totT = chart.reduce((a, b) => a + b.target, 0), totA = chart.reduce((a, b) => a + b.achieved, 0);
  return (
    <div className="page">
      <PageHead title="Sales targets" sub="Monthly targets per executive against what was actually won.">
        <select className="input" style={{ width: 110 }} value={year} onChange={(e) => setYear(+e.target.value)}>{[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}</select>
        <Tabs tabs={['Amount', 'Won Leads Count']} value={type} onChange={setType} />
        {edit && <button className="btn primary" onClick={save}><Save size={15} />Save</button>}
      </PageHead>
      <div className="grid g4 mb"><Stat label="Annual target" value={fmt(totT)} /><Stat label="Achieved" value={fmt(totA)} tone="good" /><Stat label="Completion" value={`${totT ? Math.round((totA / totT) * 100) : 0}%`} tone="accent" /><Card><div className="row" style={{ justifyContent: 'center' }}><Gauge value={totT ? Math.round((totA / totT) * 100) : 0} label="%" size={96} /></div></Card></div>
      <Card title="Target vs achieved" className="mb"><GroupedBars data={chart} series={[{ key: 'target', label: 'Target', color: 'var(--line)' }, { key: 'achieved', label: 'Achieved' }]} fmt={fmt} /></Card>
      {edit && <Card title="Spread helper" className="mb"><div className="row wrap"><Select value={spread.user} onChange={(e) => setSpread({ ...spread, user: e.target.value })} placeholder="Executive" options={users.map((u) => ({ value: u.id, label: u.name }))} /><Input type="number" placeholder="Yearly total" value={spread.total} onChange={(e) => setSpread({ ...spread, total: e.target.value })} /><button className="btn" onClick={doSpread}><Wand2 size={14} />Spread evenly over 12 months</button></div></Card>}
      <Card flush><div className="table-wrap"><table className="t"><thead><tr><th>Executive</th>{MONTHS.map((m) => <th key={m} className="right">{m}</th>)}<th className="right">Year</th></tr></thead><tbody>
        {users.map((u) => { const t = MONTHS.reduce((a, _, i) => a + (+grid[`${u.id}-${i + 1}`] || 0), 0), a = MONTHS.reduce((s, _, i) => s + (+ach[`${u.id}-${i + 1}`] || 0), 0);
          return <tr key={u.id}><td><b>{u.name}</b></td>{MONTHS.map((_, i) => { const k = `${u.id}-${i + 1}`; return <td key={k} className="right" style={{ minWidth: 86 }}>
            {edit ? <input className="input" style={{ padding: '4px 6px', textAlign: 'right' }} value={grid[k] ?? ''} onChange={(e) => setGrid({ ...grid, [k]: e.target.value })} /> : <span className="num">{fmt(grid[k] || 0)}</span>}
            {ach[k] ? <div className="small" style={{ color: ach[k] >= (grid[k] || 0) ? 'var(--good)' : 'var(--warn)' }}>{fmt(ach[k])}</div> : null}</td>; })}<td className="right"><b>{fmt(t)}</b><div className="small muted">{fmt(a)} won</div></td></tr>; })}
      </tbody></table></div></Card>
    </div>
  );
}

// ================= Lead expenses =================
export function Expenses() {
  const { can } = useAuth(); const run = useAction(); const lk = useLookups();
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [source, setSource] = useState('');
  const d = useFetch('/expenses', { from, to, source }); const [add, setAdd] = useState(false);
  const [f, setF] = useState({ date: ymd(), source_id: '', amount: '', campaign: '', description: '' });
  return (
    <div className="page">
      <PageHead title="Lead expenses" sub="Marketing spend by source — feeds cost per lead and ROI.">{can('lead_expense', 'add') && <button className="btn primary" onClick={() => setAdd(true)}><Plus size={15} />Add expense</button>}</PageHead>
      {d.data && <div className="grid g3 mb"><Stat label="Total spend" value={money(d.data.total)} icon={IndianRupee} /><Stat label="Synced from ad platforms" value={money(d.data.meta)} tone="info" /><Stat label="Entered manually" value={money(d.data.manual)} tone="accent" /></div>}
      <Card flush>
        <div className="toolbar"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /><Select value={source} onChange={(e) => setSource(e.target.value)} placeholder="All sources" options={lk.sources.map((s) => ({ value: s.id, label: s.name }))} /></div>
        {!d.data ? <Loading d={d} /> : <DataTable rows={d.data.rows} empty={<Empty title="No expenses recorded" />} columns={[
          { key: 'date', label: 'Date', render: (r) => dateFmt(r.date) }, { key: 'source', label: 'Source' }, { key: 'campaign', label: 'Campaign' }, { key: 'description', label: 'Description' },
          { key: 'origin', label: 'Origin', render: (r) => <Badge kind={r.origin === 'manual' ? 'accent' : 'info'}>{r.origin}</Badge> }, { key: 'amount', label: 'Amount', right: true, render: (r) => money(r.amount) },
          { key: 'x', label: '', nosort: true, render: (r) => can('lead_expense', 'delete') && <button className="btn sm ghost" onClick={async () => { await run(() => api.del(`/expenses/${r.id}`), 'Removed'); d.reload(); }}><Trash2 size={13} /></button> }]} />}
      </Card>
      {add && <Modal title="Add expense" onClose={() => setAdd(false)} footer={<><button className="btn" onClick={() => setAdd(false)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post('/expenses', f), 'Expense added')) { setAdd(false); d.reload(); } }}>Add</button></>}>
        <div className="col"><div className="grid g2"><Input label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /><Input label="Amount (₹)" required type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <Select label="Source" value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })} placeholder="Choose" options={lk.sources.map((s) => ({ value: s.id, label: s.name }))} /><Input label="Campaign" value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} /><Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div></Modal>}
    </div>
  );
}

// ================= Commission =================
export function Commissions() {
  const { can } = useAuth(); const run = useAction(); const d = useFetch('/commissions'); const [pay, setPay] = useState(null); const [f, setF] = useState({ amount: '', tds_percent: 10, note: '' });
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const tds = pay ? ((+f.amount || 0) * (+f.tds_percent || 0)) / 100 : 0;
  return (
    <div className="page">
      <PageHead title="Source commission" sub="What partner and referral sources have earned and been paid." />
      <div className="grid g3 mb"><Stat label="Earned" value={money(d.data.earned)} /><Stat label="Paid" value={money(d.data.paid)} tone="good" /><Stat label="Balance" value={money(d.data.balance)} tone="warn" /></div>
      <Card flush><DataTable rows={d.data.rows} empty={<Empty title="No commission sources" sub="Enable commission on a lead source in Masters." />} columns={[
        { key: 'source', label: 'Source', render: (r) => <b>{r.source}</b> }, { key: 'rate', label: 'Rate', render: (r) => (r.type === 'percent' ? `${r.rate}%` : `${money(r.rate)} / won lead`) }, { key: 'won', label: 'Won leads', right: true },
        { key: 'earned', label: 'Earned', right: true, render: (r) => money(r.earned) }, { key: 'paid', label: 'Paid', right: true, render: (r) => money(r.paid) }, { key: 'tds', label: 'TDS', right: true, render: (r) => money(r.tds) }, { key: 'balance', label: 'Balance', right: true, render: (r) => <b>{money(r.balance)}</b> },
        { key: 'x', label: '', nosort: true, render: (r) => can('lead_source_commission', 'add') && <button className="btn sm primary" onClick={() => { setPay(r); setF({ amount: Math.max(0, r.balance), tds_percent: 10, note: '' }); }}>Pay</button> }]} /></Card>
      {pay && <Modal title={`Pay ${pay.source}`} onClose={() => setPay(null)} footer={<><button className="btn" onClick={() => setPay(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await run(() => api.post(`/commissions/${pay.id}/pay`, f), 'Payment recorded')) { setPay(null); d.reload(); } }}>Record payment</button></>}>
        <div className="col"><Input label="Gross amount (₹)" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><Input label="TDS %" type="number" value={f.tds_percent} onChange={(e) => setF({ ...f, tds_percent: e.target.value })} />
          <div className="alert">TDS {money(tds)} · Net payable <b>{money((+f.amount || 0) - tds)}</b></div><Textarea label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div></Modal>}
    </div>
  );
}

// ================= Call analysis =================
export function CallAnalysis() {
  const run = useAction(); const d = useFetch('/call-analysis'); const tk = useFetch('/tokens'); const lk = useLookups(); const [add, setAdd] = useState(false); const [f, setF] = useState({ transcript: '', lead_id: '' }); const [res, setRes] = useState(null);
  const leads = useFetch('/leads', { tab: 'open', limit: 100 });
  const tone = (s) => (s === 'Positive' ? 'good' : s === 'Negative' ? 'bad' : 'warn');
  return (
    <div className="page">
      <PageHead title="AI call analysis" sub="Paste a call transcript — get sentiment, a score and a suggested lead quality. Uses tokens."><button className="btn primary" onClick={() => { setAdd(true); setRes(null); }}><Sparkles size={15} />Analyse a call</button></PageHead>
      {tk.data && <div className="alert mb">Token balance: <b>{Number(tk.data.remaining).toLocaleString('en-IN')}</b> of {Number(tk.data.free + tk.data.purchased).toLocaleString('en-IN')}</div>}
      <Card flush>{!d.data ? <Loading d={d} /> : <DataTable rows={d.data} empty={<Empty title="No analysed calls yet" />} columns={[
        { key: 'date', label: 'When', render: (r) => dateTime(r.date) }, { key: 'agent', label: 'Agent' }, { key: 'customer', label: 'Customer' }, { key: 'lead_number', label: 'Lead', render: (r) => (r.lead_number ? `#${r.lead_number}` : '—') },
        { key: 'sentiment', label: 'Sentiment', render: (r) => <Badge kind={tone(r.sentiment)}>{r.sentiment}</Badge> }, { key: 'score', label: 'Score', right: true, render: (r) => <b>{r.score}</b> }, { key: 'summary', label: 'Summary', render: (r) => <span className="small">{r.summary}</span> }]} />}</Card>
      {add && <Modal title="Analyse a call" size="lg" onClose={() => setAdd(false)} footer={<><button className="btn" onClick={() => setAdd(false)}>Close</button><button className="btn primary" onClick={async () => { const r = await run(() => api.post('/call-analysis', f)); if (r) { setRes(r); d.reload(); tk.reload(); } }}><Sparkles size={14} />Analyse</button></>}>
        <div className="col"><Select label="Link to lead (optional)" value={f.lead_id} onChange={(e) => setF({ ...f, lead_id: e.target.value })} placeholder="None" options={(leads.data?.rows || []).map((l) => ({ value: l.id, label: `#${l.number} · ${l.customer}` }))} />
          <Textarea label="Transcript" rows={9} value={f.transcript} onChange={(e) => setF({ ...f, transcript: e.target.value })} placeholder="Agent: Hello… Customer: …" />
          {res && <div className="alert good"><b>{res.sentiment}</b> · score {res.score} · suggested quality <b>{res.suggested_quality}</b> · used {res.tokens} tokens</div>}</div></Modal>}
    </div>
  );
}
