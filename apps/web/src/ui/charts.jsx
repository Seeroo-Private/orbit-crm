// Hand-made SVG charts (no dependency)
export const PALETTE = ['#4f46e5', '#ff6b4a', '#0f9d6c', '#d98206', '#0a85c2', '#a855f7', '#e11d74', '#64748b'];
const nf = (n) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : Math.round(n));

export function LineChart({ data, series, height = 220, xKey = 'date', fmt = nf }) {
  if (!data?.length) return <div className="muted small center" style={{ padding: 30 }}>No data for this period</div>;
  const W = 640, H = height, pl = 40, pr = 12, pt = 12, pb = 26;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const x = (i) => pl + (data.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (data.length - 1));
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const step = Math.ceil(data.length / 7);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" /><text x={pl - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
      {data.map((d, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{String(d[xKey]).slice(5)}</text>)}
      {series.map((s, si) => {
        const pts = data.map((d, i) => `${x(i)},${y(d[s.key] || 0)}`).join(' ');
        const c = s.color || PALETTE[si];
        return <g key={s.key}>
          <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={c} opacity=".08" />
          <polyline points={pts} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {data.length < 40 && data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d[s.key] || 0)} r="3" fill={c}><title>{`${d[xKey]} · ${s.label || s.key}: ${d[s.key] || 0}`}</title></circle>)}
        </g>;
      })}
    </svg>
  );
}

export function BarChart({ data, labelKey = 'name', valueKey = 'value', height = 220, color, fmt = nf, horizontal }) {
  if (!data?.length) return <div className="muted small center" style={{ padding: 30 }}>No data</div>;
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  if (horizontal) {
    return (
      <div className="col gap-sm">
        {data.map((d, i) => (
          <div key={i} className="row" style={{ gap: 10 }}>
            <div className="truncate small" style={{ width: 130 }} title={d[labelKey]}>{d[labelKey]}</div>
            <div className="grow bar" style={{ height: 14 }}><i style={{ width: `${((d[valueKey] || 0) / max) * 100}%`, background: color || PALETTE[i % PALETTE.length] }} /></div>
            <b className="num small" style={{ width: 60, textAlign: 'right' }}>{fmt(d[valueKey] || 0)}</b>
          </div>
        ))}
      </div>
    );
  }
  const W = 640, H = height, pl = 40, pb = 40, pt = 10, bw = (W - pl - 10) / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pl} x2={W - 10} y1={pt + (1 - t) * (H - pt - pb)} y2={pt + (1 - t) * (H - pt - pb)} stroke="var(--line)" strokeDasharray="3 4" /><text x={pl - 6} y={pt + (1 - t) * (H - pt - pb) + 4} textAnchor="end">{fmt(t * max)}</text></g>)}
      {data.map((d, i) => { const h = ((d[valueKey] || 0) / max) * (H - pt - pb); return <g key={i}><rect x={pl + i * bw + bw * 0.18} y={H - pb - h} width={bw * 0.64} height={h} rx="5" fill={color || PALETTE[i % PALETTE.length]}><title>{`${d[labelKey]}: ${d[valueKey]}`}</title></rect><text x={pl + i * bw + bw / 2} y={H - pb + 14} textAnchor="middle">{String(d[labelKey]).slice(0, 10)}</text></g>; })}
    </svg>
  );
}

export function GroupedBars({ data, series, labelKey = 'name', height = 230, fmt = nf }) {
  if (!data?.length) return <div className="muted small center" style={{ padding: 30 }}>No data</div>;
  const W = 640, H = height, pl = 40, pb = 40, pt = 10, gw = (W - pl - 10) / data.length;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const bw = (gw * 0.76) / series.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pl} x2={W - 10} y1={pt + (1 - t) * (H - pt - pb)} y2={pt + (1 - t) * (H - pt - pb)} stroke="var(--line)" strokeDasharray="3 4" /><text x={pl - 6} y={pt + (1 - t) * (H - pt - pb) + 4} textAnchor="end">{fmt(t * max)}</text></g>)}
      {data.map((d, i) => <g key={i}>{series.map((s, si) => { const h = ((d[s.key] || 0) / max) * (H - pt - pb); return <rect key={s.key} x={pl + i * gw + gw * 0.12 + si * bw} y={H - pb - h} width={bw - 2} height={h} rx="4" fill={s.color || PALETTE[si]}><title>{`${d[labelKey]} · ${s.label || s.key}: ${d[s.key]}`}</title></rect>; })}<text x={pl + i * gw + gw / 2} y={H - pb + 14} textAnchor="middle">{String(d[labelKey]).split(' ')[0].slice(0, 10)}</text></g>)}
    </svg>
  );
}

export function Donut({ data, size = 170, center, thickness = 22 }) {
  const total = data.reduce((a, d) => a + (d.value || 0), 0);
  const r = (size - thickness) / 2, c = 2 * Math.PI * r; let off = 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={thickness} />
        {total > 0 && data.map((d, i) => { const len = (d.value / total) * c; const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color || PALETTE[i % PALETTE.length]} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off}><title>{`${d.label}: ${d.value}`}</title></circle>; off += len; return el; })}
      </svg>
      <div className="mid">{center ?? <><b style={{ fontSize: 22 }}>{total}</b><div className="small muted">total</div></>}</div>
    </div>
  );
}
export const Legend = ({ items }) => <div className="legend">{items.map((d, i) => <span key={i}><i style={{ background: d.color || PALETTE[i % PALETTE.length] }} />{d.label}{d.value !== undefined && ` · ${d.value}`}</span>)}</div>;

export function Funnel({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="col gap-sm">
      {data.map((d, i) => (
        <div key={i} className="row">
          <div style={{ width: 110 }} className="small">{d.stage}</div>
          <div className="grow" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: `${Math.max(6, (d.count / max) * 100)}%`, background: PALETTE[i % PALETTE.length], height: 28, borderRadius: 8, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, transition: 'width .4s' }}>{d.count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Spark({ values, color = 'var(--brand)', w = 90, h = 28 }) {
  if (!values?.length) return null;
  const max = Math.max(1, ...values), pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 3) - 1}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function Gauge({ value, label, size = 110 }) {
  const v = Math.max(0, Math.min(100, value || 0)); const color = v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--warn)' : 'var(--bad)';
  return <Donut size={size} thickness={12} data={[{ label, value: v, color }, { label: 'rest', value: 100 - v, color: 'var(--line-2)' }]} center={<><b style={{ fontSize: 22 }}>{v}</b><div className="small muted">{label}</div></>} />;
}
