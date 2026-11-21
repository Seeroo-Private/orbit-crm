import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, TrendingUp, TrendingDown, Minus, Trophy, Target, Flame, Snowflake, PhoneOff, PhoneMissed, Sparkles, Trash2, Printer } from 'lucide-react';
import { api, money, compact, downloadCsv, dateFmt, dateTime, ymd } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFetch, Loading, PageHead, Card, Tabs, Badge, DataTable, Stat, Empty, Bar, Chips } from '../ui/kit.jsx';
import { LineChart, BarChart, GroupedBars, Donut, Legend, Funnel, Gauge, PALETTE } from '../ui/charts.jsx';
import { useLookups } from './Leads.jsx';

const PERIODS = [{ id: 'today', label: 'Today' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'last_month', label: 'Last month' }, { id: 'year', label: 'Year' }, { id: '', label: 'All' }];

// ================= CRM dashboard =================
export function CrmDashboard() {
  const nav = useNavigate(); const lk = useLookups();
  const [f, setF] = useState({ period: 'month', branch: '', assignee: '', source: '' }); const [tab, setTab] = useState('overview');
  const d = useFetch('/dashboard/crm', f);
  const x = d.data;
  return (
    <div className="page">
      <PageHead title="CRM dashboard" sub="Pipeline health, conversion and what needs attention.">
        <select className="input" style={{ width: 140 }} value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <select className="input" style={{ width: 150 }} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">All branches</option>{lk.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="input" style={{ width: 150 }} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}><option value="">All executives</option>{lk.people.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="input" style={{ width: 150 }} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">All sources</option>{lk.sources.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </PageHead>
      {!x ? <Loading d={d} /> : (<>
        <div className="grid g4 mb">
          <Stat label="Win rate" value={`${x.kpis.win_rate}%`} sub={`${x.tiles.won.count} won · ${x.tiles.lost.count} lost`} tone="good" />
          <Stat label="Conversion" value={`${x.kpis.conversion_rate}%`} sub={`of ${x.tiles.total.count} leads`} tone="accent" />
          <Stat label="Open pipeline" value={compact(x.kpis.pipeline_value)} sub={`${x.kpis.active_pipeline_ratio}% of leads active`} />
          <Stat label="Won value" value={compact(x.tiles.won.value)} tone="info" />
        </div>
        <div className="mb"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'attention', label: 'Needs attention', count: x.attention.delayed.length + x.attention.untouched.length }, { id: 'pipeline', label: 'Pipeline' }, { id: 'team', label: 'Team' }, { id: 'sources', label: 'Sources & ROI' }, { id: 'items', label: 'Items' }, { id: 'calls', label: 'Calls' }]} /></div>
        {tab === 'overview' && (<>
          <div className="grid g4 mb">
            {[['New', x.tiles.new, 'info', Sparkles], ['Warm', x.tiles.warm, 'warn', Flame], ['Hot', x.tiles.hot, 'accent', Flame], ['Super hot', x.tiles.super_hot, 'bad', Flame], ['Cold', x.tiles.cold, '', Snowflake], ['Not connected', x.tiles.not_connected, '', PhoneOff], ['Not reachable', x.tiles.not_reachable, '', PhoneMissed], ['Lost', x.tiles.lost, '', TrendingDown]].map(([l, t, tone, I]) => <Stat key={l} label={l} value={t.count} sub={compact(t.value)} tone={tone} icon={I} onClick={() => nav('/leads')} />)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Card title="Leads created vs won"><LineChart data={x.series} series={[{ key: 'leads', label: 'Leads' }, { key: 'won', label: 'Won', color: 'var(--good)' }]} fmt={(n) => Math.round(n)} /><Legend items={[{ label: 'Leads' }, { label: 'Won', color: '#0f9d6c' }]} /></Card>
            <Card title="Follow-ups"><div className="col" style={{ alignItems: 'center' }}><Donut size={160} data={[{ label: 'Today', value: x.ring.today, color: PALETTE[0] }, { label: 'Delayed', value: x.ring.delayed, color: '#dc3c3c' }, { label: 'Upcoming', value: x.ring.upcoming, color: PALETTE[2] }]} /><Legend items={[{ label: 'Today', value: x.ring.today, color: PALETTE[0] }, { label: 'Delayed', value: x.ring.delayed, color: '#dc3c3c' }, { label: 'Upcoming', value: x.ring.upcoming, color: PALETTE[2] }]} /></div></Card>
          </div>
        </>)}
        {tab === 'attention' && (
          <div className="grid g3" style={{ alignItems: 'start' }}>
            <Card title={`Delayed follow-ups (${x.attention.delayed.length})`}>{x.attention.delayed.map((l) => <Link key={l.id} to={`/leads/${l.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}><div className="grow"><b>#{l.number} {l.customer}</b><div className="small muted">{l.assignee}</div></div><Badge kind="bad">{dateTime(l.next_followup)}</Badge></Link>)}{!x.attention.delayed.length && <Empty title="All on time" />}</Card>
            <Card title={`Untouched new leads (${x.attention.untouched.length})`}>{x.attention.untouched.map((l) => <Link key={l.id} to={`/leads/${l.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}><div className="grow"><b>#{l.number} {l.customer}</b><div className="small muted">{l.assignee}</div></div><span className="small muted">{dateFmt(l.created_at)}</span></Link>)}{!x.attention.untouched.length && <Empty title="None waiting" />}</Card>
            <Card title={`No next step (${x.attention.no_next.length})`}>{x.attention.no_next.map((l) => <Link key={l.id} to={`/leads/${l.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}><div className="grow"><b>#{l.number} {l.customer}</b><div className="small muted">{l.assignee}</div></div></Link>)}{!x.attention.no_next.length && <Empty title="Everything has a next step" />}<div className="alert warn mt small">SLA breaches in this period: <b>{x.attention.sla}</b></div></Card>
          </div>)}
        {tab === 'pipeline' && <div className="grid g2"><Card title="Funnel by stage"><Funnel data={x.pipeline.filter((p) => p.stage !== 'Lost' && p.stage !== 'Nurture')} /></Card><Card title="Value by stage"><BarChart data={x.pipeline.map((p) => ({ name: p.stage, value: p.value }))} /></Card><Card title="By status"><BarChart horizontal data={x.byStatus.map((s) => ({ name: s.name, value: s.count }))} fmt={(n) => n} /></Card></div>}
        {tab === 'team' && <Card flush><DataTable rows={x.team} columns={[{ key: 'name', label: 'Executive', render: (r) => <b>{r.name}</b> }, { key: 'leads', label: 'Leads', right: true }, { key: 'open', label: 'Open', right: true }, { key: 'won', label: 'Won', right: true }, { key: 'lost', label: 'Lost', right: true }, { key: 'conversion', label: 'Conversion', right: true, render: (r) => `${r.conversion}%` }, { key: 'won_value', label: 'Won value', right: true, render: (r) => money(r.won_value) }, { key: 'bar', label: '', nosort: true, render: (r) => <div style={{ width: 90 }}><Bar pct={r.conversion * 2} /></div> }]} /></Card>}
        {tab === 'sources' && <><Card title="Leads and wins by source" className="mb"><GroupedBars data={x.sources} series={[{ key: 'leads', label: 'Leads' }, { key: 'won', label: 'Won', color: '#0f9d6c' }]} fmt={(n) => Math.round(n)} /></Card>
          <Card flush><DataTable rows={x.sources} columns={[{ key: 'name', label: 'Source', render: (r) => <b>{r.name}</b> }, { key: 'leads', label: 'Leads', right: true }, { key: 'won', label: 'Won', right: true }, { key: 'conversion', label: 'Conv.', right: true, render: (r) => `${r.conversion}%` }, { key: 'won_value', label: 'Revenue', right: true, render: (r) => money(r.won_value) }, { key: 'spend', label: 'Spend', right: true, render: (r) => money(r.spend) }, { key: 'cpl', label: 'Cost / lead', right: true, render: (r) => (r.cpl ? money(r.cpl) : '—') }, { key: 'roi', label: 'ROI', right: true, render: (r) => (r.roi === null ? '—' : <Badge kind={r.roi >= 0 ? 'good' : 'bad'}>{r.roi}%</Badge>) }]} /></Card></>}
        {tab === 'items' && <Card flush><DataTable rows={x.items} empty={<Empty title="No item data" />} columns={[{ key: 'name', label: 'Item', render: (r) => <b>{r.name}</b> }, { key: 'leads', label: 'Enquiries', right: true }, { key: 'won', label: 'Won', right: true }, { key: 'value', label: 'Value', right: true, render: (r) => money(r.value) }]} /></Card>}
        {tab === 'calls' && <div className="grid g2"><Card title="Sentiment"><div className="col" style={{ alignItems: 'center' }}><Donut data={x.calls.map((c, i) => ({ label: c.sentiment, value: c.n, color: { Positive: '#0f9d6c', Neutral: '#d98206', Negative: '#dc3c3c' }[c.sentiment] }))} /></div></Card><Card title="Agent scores"><BarChart horizontal data={x.callAgents.map((a) => ({ name: a.name, value: Math.round(a.score) }))} fmt={(n) => n} /></Card></div>}
      </>)}
    </div>
  );
}

// ================= Executive performance =================
export function Executives() {
  const [period, setPeriod] = useState('month'); const d = useFetch('/dashboard/executive', { period });
  return (
    <div className="page">
      <PageHead title="Executive performance" sub="One score per person — target achievement, conversion, timeliness, SLA and calls."><select className="input" style={{ width: 140 }} value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></PageHead>
      {!d.data ? <Loading d={d} /> : <div className="grid g3">{d.data.map((e, i) => (
        <Card key={e.id}><div className="row between"><div className="row"><span className="avatar">{i === 0 ? <Trophy size={15} /> : i + 1}</span><div><b>{e.name}</b><div className="small muted">{e.leads} leads · {e.won} won</div></div></div><Gauge value={e.score} label="score" size={92} /></div>
          <div className="grid g2 mt small"><div><span className="muted">Conversion</span><div><b>{e.conversion}%</b></div></div><div><span className="muted">Won value</span><div><b>{compact(e.won_value)}</b></div></div><div><span className="muted">Target</span><div><b>{e.achievement === null ? '—' : `${e.achievement}%`}</b></div></div><div><span className="muted">Delayed</span><div><b style={{ color: e.delayed ? 'var(--bad)' : 'inherit' }}>{e.delayed}</b></div></div><div><span className="muted">SLA breaches</span><div><b>{e.sla_breaches}</b></div></div><div><span className="muted">Call score</span><div><b>{e.call_score ?? '—'}</b></div></div></div></Card>))}</div>}
    </div>
  );
}

// ================= Forecast =================
export function Forecast() {
  const d = useFetch('/dashboard/forecast');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const x = d.data; const T = { up: [TrendingUp, 'Trending up', 'good'], down: [TrendingDown, 'Trending down', 'bad'], flat: [Minus, 'Flat', ''] }[x.trend]; const I = T[0];
  const data = [...x.history.map((h) => ({ date: h.week, actual: h.actual })), ...x.forecast.map((h) => ({ date: h.week, forecast: h.forecast }))];
  return (
    <div className="page">
      <PageHead title="Lead forecast" sub="Twelve weeks of history, projected six weeks ahead." />
      <div className="grid g4 mb"><Stat label="Trend" value={T[1]} tone={T[2]} icon={I} /><Stat label="Open leads" value={x.open_leads} /><Stat label="Win rate" value={`${x.win_rate}%`} tone="accent" /><Stat label="Expected won value" value={compact(x.expected_won_value)} sub="open value × win rate" tone="good" /></div>
      <Card title="Weekly new leads — actual and forecast"><LineChart data={data} series={[{ key: 'actual', label: 'Actual' }, { key: 'forecast', label: 'Forecast', color: '#ff6b4a' }]} fmt={(n) => Math.round(n)} /><Legend items={[{ label: 'Actual' }, { label: 'Forecast', color: '#ff6b4a' }]} /></Card>
    </div>
  );
}

// ================= Reports =================
export function Reports() {
  const d = useFetch('/reports'); const custom = useFetch('/custom-reports'); const nav = useNavigate();
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const groups = [...new Set(d.data.map((r) => r.group))];
  return (
    <div className="page">
      <PageHead title="Reports" sub="Every report can be filtered by period and exported as CSV." />
      {groups.map((g) => <div key={g} className="mb"><h3 className="mb" style={{ fontSize: 15 }}>{g}</h3><div className="grid g3">{d.data.filter((r) => r.group === g).map((r) => <Link key={r.key} to={`/reports/${r.key}`} className="card card-b" style={{ color: 'inherit', textDecoration: 'none' }}><b>{r.title}</b><div className="small muted" style={{ marginTop: 4 }}>{r.desc}</div></Link>)}</div></div>)}
      {(custom.data || []).length > 0 && <div><h3 className="mb" style={{ fontSize: 15 }}>Custom reports</h3><div className="grid g3">{custom.data.map((r) => <Link key={r.id} to={`/reports/custom-${r.id}`} className="card card-b" style={{ color: 'inherit', textDecoration: 'none' }}><b>{r.name}</b><div className="small muted">{r.entity}</div></Link>)}</div></div>}
    </div>
  );
}

export function ReportView() {
  const { name } = useParams(); const lk = useLookups(); const [f, setF] = useState({ period: 'month', assignee: '', source: '', month: ymd().slice(0, 7) });
  const custom = name.startsWith('custom-'); const path = custom ? `/dynamic-report/${name.slice(7)}/run` : `/reports/${name}`;
  const d = useFetch(path, f);
  const fmtCell = (c, v) => (v === null || v === undefined || v === '' ? '—' : c.type === 'money' ? money(v) : c.type === 'date' ? dateFmt(v) : v);
  const x = d.data; const cols = x?.columns?.map((c) => ({ key: c.key, label: c.label, right: c.type === 'num' || c.type === 'money', render: (r) => fmtCell(c, r[c.key]) }));
  return (
    <div className="page">
      <PageHead title={x?.title || 'Report'} sub={x?.desc} crumbs={<Link to="/reports">Reports</Link>}>
        {name === 'worked_hours' ? <input className="input" type="month" style={{ width: 160 }} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} /> : !custom && <select className="input" style={{ width: 140 }} value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
        {['leads', 'lead_funnel', 'lead_source_performance', 'lost_lead_analysis'].includes(name) && <><select className="input" style={{ width: 150 }} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}><option value="">All executives</option>{lk.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></>}
        {x && <button className="btn" onClick={() => downloadCsv(name, x.columns, x.rows)}><Download size={14} />CSV</button>}<button className="btn no-print" onClick={() => window.print()}><Printer size={14} />Print</button>
      </PageHead>
      {!x ? <Loading d={d} /> : (<>
        {x.chart === 'funnel' && <Card className="mb" title="Funnel"><Funnel data={x.rows.filter((r) => r.stage !== 'Lost').map((r) => ({ stage: r.stage, count: r.count }))} /></Card>}
        <Card flush>{x.rows.length ? <DataTable rows={x.rows.map((r, i) => ({ id: i, ...r }))} columns={cols} dense /> : <Empty title="No data for this period" />}</Card>
        <div className="small muted mt">{x.rows.length} row{x.rows.length === 1 ? '' : 's'}</div>
      </>)}
    </div>
  );
}
