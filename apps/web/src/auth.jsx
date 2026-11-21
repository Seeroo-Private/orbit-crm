import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const DICT = {
  ar: { Home: 'الرئيسية', CRM: 'العملاء', Tasks: 'المهام', Reports: 'التقارير', Master: 'الإعدادات', Team: 'الفريق', Leads: 'العملاء المحتملون', Customers: 'العملاء', Quotations: 'عروض الأسعار', Search: 'بحث', Save: 'حفظ', Cancel: 'إلغاء' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('orbit.theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('orbit.lang') || 'en');

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('orbit.theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; localStorage.setItem('orbit.lang', lang); }, [lang]);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try { setUser(await api.get('/auth/me')); } catch { setToken(null); setUser(null); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); const f = () => setUser(null); window.addEventListener('orbit:logout', f); return () => window.removeEventListener('orbit:logout', f); }, [refresh]);

  const login = async (tenant, username, password) => { const { token } = await api.post('/auth/login', { tenant, username, password }); setToken(token); await refresh(); };
  const logout = () => { setToken(null); setUser(null); };

  // perms: owner bypass; resource.action
  const can = useCallback((res, action = 'view') => {
    if (!user) return false;
    if (user.is_owner) return true;
    const p = user.perms?.[res];
    if (!p) return false;
    if (action === 'view') return !!(p.view_all || p.add || p.edit || p.delete || p.confirm || p.export);
    return !!p[action];
  }, [user]);
  const t = useCallback((s) => (lang === 'ar' && DICT.ar[s]) || s, [lang]);

  return <Ctx.Provider value={{ user, ready, login, logout, refresh, can, theme, setTheme, lang, setLang, t }}>{children}</Ctx.Provider>;
}
