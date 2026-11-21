import { Card } from './kit.jsx';
import { compact, money } from '../api.js';
import { bom, estimate, manpower, roll } from './costing.js';
import { total } from './ProjectTree.jsx';

const Tile = ({ label, value, sub, tone }) => (
  <div className="card stat"><div className="lbl">{label}</div><div className="val" style={tone ? { color: `var(--${tone})` } : null}>{value}</div>{sub && <div className="sub">{sub}</div>}</div>
);

// Cost, bill of materials and manpower summary for a structure at a given system size.
export default function CostPanel({ nodes, size = 1, unit = 'unit', params = {} }) {
  const e = estimate(nodes, size, params);
  const items = bom(nodes, size); const crew = manpower(nodes, size);
  const days = total(nodes);
  if (!e.materials && !e.labour) return <Card><div className="empty">No materials or manpower defined yet — open an item and use its Materials / Manpower tabs.</div></Card>;
  const phases = nodes.map((n) => ({ n, ...roll(n, size) })).filter((x) => x.mat + x.lab > 0);
  const base = e.materials + e.labour || 1;
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid g4">
        <Tile label="Materials" value={compact(e.materials)} sub={`${items.length} line items`} />
        <Tile label="Manpower" value={compact(e.labour)} sub={`${e.md.toFixed(1)} man-days`} />
        <Tile label="Estimated total" value={compact(e.total)} sub={`incl. overhead ${params.overhead || 0}% + GST · ${compact(e.total / size)} per ${unit}`} />
        <Tile label={e.subsidy ? 'Net after subsidy' : 'Total payable'} value={compact(e.net)} tone={e.subsidy ? 'good' : undefined} sub={e.subsidy ? `${params.subsidy?.label || 'Subsidy'}: ${compact(e.subsidy)}` : undefined} />
      </div>
      <div className="pm-cols">
        <Card title="Bill of materials" flush>
          <table className="t"><thead><tr><th>Item</th><th className="right">Qty</th><th>Unit</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
            <tbody>{items.map((x) => <tr key={`${x.item}${x.rate}`}><td>{x.item}</td><td className="right num">{x.qty}</td><td className="muted">{x.unit}</td><td className="right num">{money(x.rate)}</td><td className="right num"><b>{money(x.amount)}</b></td></tr>)}
              <tr><td colSpan="4" className="right b">Materials subtotal</td><td className="right num b">{money(e.materials)}</td></tr></tbody></table>
        </Card>
        <div className="col" style={{ gap: 14 }}>
          <Card title="Manpower plan" flush>
            <table className="t"><thead><tr><th>Role</th><th className="right">Man-days</th><th className="right">₹ / day</th><th className="right">Cost</th></tr></thead>
              <tbody>{crew.map((x) => <tr key={x.role}><td>{x.role}</td><td className="right num">{x.md}</td><td className="right num">{money(x.rate)}</td><td className="right num"><b>{money(x.cost)}</b></td></tr>)}
                <tr><td className="b">Total</td><td className="right num b">{e.md.toFixed(1)}</td><td /><td className="right num b">{money(e.labour)}</td></tr></tbody></table>
            <div className="card-b small muted">{e.md.toFixed(1)} man-days over a {days}-day schedule. On-site crews are sized per task; durations follow man-days ÷ crew.</div>
          </Card>
          <Card title="Cost summary">
            {[['Materials', e.materials], ['Manpower', e.labour], [`Overhead & margin (${params.overhead || 0}%)`, e.overhead], [`GST (${params.gstGoods || 0}% goods / ${params.gstServices || 0}% services)`, e.gst]].map(([l, v]) => <div className="row between small" key={l} style={{ padding: '5px 0' }}><span className="muted">{l}</span><span className="num">{money(Math.round(v))}</span></div>)}
            <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', marginTop: 4 }}><b>Total</b><b className="num">{money(Math.round(e.total))}</b></div>
            {e.subsidy > 0 && <><div className="row between small" style={{ padding: '5px 0' }}><span className="muted">{params.subsidy?.label}</span><span className="num" style={{ color: 'var(--good)' }}>− {money(e.subsidy)}</span></div>
              <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}><b>Net payable by customer</b><b className="num">{money(Math.round(e.net))}</b></div></>}
          </Card>
        </div>
      </div>
      {phases.length > 0 && <Card title="Cost by phase" flush>
        <table className="t"><thead><tr><th>Phase</th><th className="right">Materials</th><th className="right">Manpower</th><th className="right">Man-days</th><th style={{ width: '30%' }}>Share of direct cost</th></tr></thead>
          <tbody>{phases.map(({ n, mat, lab, md }) => <tr key={n.id}><td><b>{n.name}</b></td><td className="right num">{money(Math.round(mat))}</td><td className="right num">{money(Math.round(lab))}</td><td className="right num">{md.toFixed(1)}</td>
            <td><div className="pm-bar2"><i style={{ width: `${(mat / base) * 100}%`, background: 'var(--brand)' }} /><i style={{ width: `${(lab / base) * 100}%`, background: 'var(--accent)' }} /></div></td></tr>)}</tbody></table>
        <div className="card-b small muted row"><span className="row"><i style={{ width: 10, height: 10, background: 'var(--brand)', borderRadius: 3 }} />Materials</span><span className="row"><i style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 3 }} />Manpower</span></div>
      </Card>}
      {params.assumptions?.length > 0 && <Card title="Assumptions & things to verify"><ul className="pm-note">{params.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></Card>}
    </div>
  );
}
