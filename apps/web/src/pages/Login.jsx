import { useState } from 'react';
import { ArrowRight, Radar, Workflow, Gauge } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Logo } from '../layout/Layout.jsx';

export default function Login() {
  const { login } = useAuth();
  const [f, setF] = useState({ tenant: 'DEMO', username: 'admin', password: 'admin123' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(f.tenant, f.username, f.password); } catch (x) { setErr(x.message); } setBusy(false); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="auth">
      <div className="auth-art">
        <div className="row"><div className="logo" style={{ margin: 0 }}><Logo size={26} /></div><b style={{ fontSize: 20 }}>Orbit CRM</b></div>
        <div>
          <h1>Every lead, task and follow-up in one orbit.</h1>
          <p>A lead-to-cash workspace for sales teams: enquiries, follow-ups, quotations, targets, tasks and reports — with your people and your plan limits built in.</p>
          <div className="col" style={{ marginTop: 26, opacity: .9 }}>
            <div className="row"><Radar size={18} />SLA watch & auto-assignment</div><div className="row"><Workflow size={18} />Automations, tasks & timers</div><div className="row"><Gauge size={18} />Forecasts, funnels & ROI by source</div>
          </div>
        </div>
        <div className="small" style={{ opacity: .6 }}>Demo: company DEMO · admin / admin123</div>
        <div className="orbit" />
      </div>
      <div className="auth-form">
        <form className="auth-card col" style={{ gap: 16 }} onSubmit={submit}>
          <div><h2 style={{ fontSize: 26, fontWeight: 800 }}>Welcome back</h2><p className="muted" style={{ margin: '4px 0 0' }}>Sign in to your workspace</p></div>
          <div className="field"><label>Company code</label><input className="input" value={f.tenant} onChange={set('tenant')} autoFocus /></div>
          <div className="field"><label>Username</label><input className="input" value={f.username} onChange={set('username')} /></div>
          <div className="field"><label>Password</label><input className="input" type="password" value={f.password} onChange={set('password')} /></div>
          {err && <div className="alert bad">{err}</div>}
          <button className="btn primary block" disabled={busy} style={{ padding: 12 }}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
          <div className="small muted" style={{ textAlign: 'center' }}>New here? <a href="/signup">Start a free trial</a></div>
        </form>
      </div>
    </div>
  );
}
