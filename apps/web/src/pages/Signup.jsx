import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { api, money, setToken } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Logo } from '../layout/Layout.jsx';

const STEPS = ['Company', 'Your account', 'Plan', 'Review'];

export default function Signup() {
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [trial, setTrial] = useState(14);
  const [c, setC] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '' });
  const [a, setA] = useState({ name: '', designation: '', email: '', phone: '', username: '', password: '', confirm: '' });
  const [users, setUsers] = useState(5);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/signup/plans').then((d) => { setPlans(d.plans); setTrial(d.trial_days); }).catch((x) => setErr(x.message)); }, []);
  const plan = plans.find((p) => users >= p.min && users <= p.max);
  const maxUsers = plans.at(-1)?.max || 100;
  const total = plan ? users * plan.per_user : 0;
  const setCo = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const setAd = (k) => (e) => setA({ ...a, [k]: e.target.value });

  const validate = () => {
    if (step === 0) { if (!c.name.trim()) return 'Company name is required'; if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return 'Company email looks invalid'; }
    if (step === 1) {
      if (!a.name.trim()) return 'Your name is required';
      if (!/^\S+@\S+\.\S+$/.test(a.email)) return 'A valid email is required';
      if (!/^[a-z0-9._-]{3,}$/i.test(a.username)) return 'Username needs 3+ letters, digits, . _ or -';
      if (a.password.length < 6) return 'Password needs 6+ characters';
      if (a.password !== a.confirm) return 'Passwords do not match';
    }
    if (step === 2 && !plan) return `Choose between 1 and ${maxUsers} users`;
    return '';
  };
  const next = () => { const m = validate(); setErr(m); if (!m) setStep(step + 1); };
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const { confirm, ...admin } = a;
      const res = await api.post('/signup', { company: c, admin, users, plan: plan.id });
      setToken(res.token); window.history.replaceState(null, '', '/'); await refresh();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="row"><div className="logo" style={{ margin: 0 }}><Logo size={26} /></div><b style={{ fontSize: 20 }}>Orbit CRM</b></div>
        <div>
          <h1>Start your {trial}-day free trial.</h1>
          <p>Set up your company, create your admin account and pick a plan sized to your team. No card needed.</p>
          <div className="col" style={{ marginTop: 26 }}>
            {STEPS.map((s, i) => (
              <div key={s} className="row" style={{ opacity: i <= step ? 1 : .5 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: i < step ? 'var(--good, #3fd3a0)' : 'rgba(255,255,255,.18)', fontSize: 13, fontWeight: 700 }}>{i < step ? <Check size={14} /> : i + 1}</span>{s}
              </div>
            ))}
          </div>
        </div>
        <div className="small" style={{ opacity: .6 }}>Already have a workspace? <a href="/login" style={{ color: 'inherit' }}>Sign in</a></div>
        <div className="orbit" />
      </div>
      <div className="auth-form">
        <div className="auth-card col" style={{ gap: 16, maxWidth: step === 2 ? 640 : undefined }}>
          <div><div className="small muted">Step {step + 1} of {STEPS.length}</div><h2 style={{ fontSize: 26, fontWeight: 800, margin: '2px 0 0' }}>{['Tell us about your company', 'Create the first user', 'Choose your plan', 'Review & start trial'][step]}</h2></div>

          {step === 0 && <>
            <div className="field"><label>Company name *</label><input className="input" value={c.name} onChange={setCo('name')} autoFocus /></div>
            <div className="grid g2">
              <div className="field"><label>Company email</label><input className="input" type="email" value={c.email} onChange={setCo('email')} /></div>
              <div className="field"><label>Phone</label><input className="input" value={c.phone} onChange={setCo('phone')} /></div>
            </div>
            <div className="field"><label>Address</label><input className="input" value={c.address} onChange={setCo('address')} /></div>
            <div className="grid g2">
              <div className="field"><label>City</label><input className="input" value={c.city} onChange={setCo('city')} /></div>
              <div className="field"><label>State</label><input className="input" value={c.state} onChange={setCo('state')} /></div>
            </div>
          </>}

          {step === 1 && <>
            <div className="grid g2">
              <div className="field"><label>Full name *</label><input className="input" value={a.name} onChange={setAd('name')} autoFocus /></div>
              <div className="field"><label>Designation</label><input className="input" placeholder="Owner" value={a.designation} onChange={setAd('designation')} /></div>
            </div>
            <div className="grid g2">
              <div className="field"><label>Email *</label><input className="input" type="email" value={a.email} onChange={setAd('email')} /></div>
              <div className="field"><label>Phone</label><input className="input" value={a.phone} onChange={setAd('phone')} /></div>
            </div>
            <div className="field"><label>Username *</label><input className="input" value={a.username} onChange={setAd('username')} autoComplete="username" /></div>
            <div className="grid g2">
              <div className="field"><label>Password *</label><input className="input" type="password" value={a.password} onChange={setAd('password')} autoComplete="new-password" /></div>
              <div className="field"><label>Confirm password *</label><input className="input" type="password" value={a.confirm} onChange={setAd('confirm')} autoComplete="new-password" /></div>
            </div>
            <div className="small muted">This user becomes the workspace owner with full access. You can add the rest of your team after sign-up.</div>
          </>}

          {step === 2 && <>
            <div className="field">
              <label>How many users will use Orbit? <b>{users}</b></label>
              <input type="range" min={1} max={maxUsers} value={users} onChange={(e) => setUsers(+e.target.value)} />
              <input className="input" type="number" min={1} max={maxUsers} value={users} onChange={(e) => setUsers(Math.max(1, Math.min(maxUsers, +e.target.value || 1)))} style={{ width: 120 }} />
            </div>
            <div className="grid g3">
              {plans.map((p) => {
                const on = plan?.id === p.id;
                return (
                  <button type="button" key={p.id} onClick={() => setUsers(Math.min(Math.max(users, p.min), p.max))} className="card" style={{ textAlign: 'left', padding: 14, cursor: 'pointer', border: on ? '2px solid var(--accent, #4f46e5)' : '1px solid var(--line, #e5e7eb)' }}>
                    <b style={{ fontSize: 16 }}>{p.name}</b> {on && <span className="small" style={{ color: 'var(--accent, #4f46e5)' }}>· recommended</span>}
                    <div className="small muted">{p.min}–{p.max} users</div>
                    <div style={{ margin: '8px 0', fontSize: 20, fontWeight: 800 }}>{money(p.per_user)}<span className="small muted" style={{ fontWeight: 400 }}> /user/mo</span></div>
                    <div className="small muted">{p.blurb}</div>
                  </button>
                );
              })}
            </div>
            {plan && <div className="alert">{users} users on <b>{plan.name}</b> = <b>{money(total)}</b>/month after the trial. Free for the first {trial} days.</div>}
          </>}

          {step === 3 && <>
            <div className="col" style={{ gap: 10 }}>
              <div className="card" style={{ padding: 14 }}><div className="small muted">Company</div><b>{c.name}</b><div className="small muted">{[c.email, c.phone, c.address, c.city, c.state].filter(Boolean).join(' · ')}</div></div>
              <div className="card" style={{ padding: 14 }}><div className="small muted">Owner</div><b>{a.name}</b><div className="small muted">{a.email} · username {a.username}</div></div>
              <div className="card" style={{ padding: 14 }}><div className="small muted">Plan</div><b>{plan?.name} · {users} users</b><div className="small muted">{money(total)}/month after a {trial}-day free trial</div></div>
            </div>
          </>}

          {err && <div className="alert bad">{err}</div>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            {step > 0 ? <button type="button" className="btn" onClick={() => { setErr(''); setStep(step - 1); }}><ArrowLeft size={16} /> Back</button> : <span />}
            {step < 3
              ? <button type="button" className="btn primary" onClick={next}>Continue <ArrowRight size={16} /></button>
              : <button type="button" className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Creating workspace…' : <>Start free trial <ArrowRight size={16} /></>}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
