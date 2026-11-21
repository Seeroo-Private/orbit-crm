import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { q, one } from './db.js';
import { seedAll } from './seed.js';
import masters from './routes/masters.js';
import crm, { slaSweep } from './routes/crm.js';
import tasks from './routes/tasks.js';
import insights from './routes/insights.js';
import comms from './routes/comms.js';
import projects, { seedDemoProjects } from './routes/projects.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!one('SELECT COUNT(*) n FROM tenants').n) { seedAll(); console.log('Seeded demo data (company DEMO, admin / admin123)'); }

for (const t of q('SELECT id FROM tenants WHERE code=?', 'DEMO')) { try { seedDemoProjects(t.id); } catch (e) { console.error('project seed', e.message); } }

app.get('/api/health', (_q, res) => res.json({ ok: true }));
// masters.js registers public /auth/login first, then enforces auth for everything after it,
// so the remaining routers are mounted behind that gate.
app.use('/api', masters);
app.use('/api', crm);
app.use('/api', tasks);
app.use('/api', insights);
app.use('/api', comms);
app.use('/api', projects);

// serve the built web app in production
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_q, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

setInterval(() => { try { for (const t of q('SELECT id FROM tenants')) slaSweep(t.id); } catch (e) { console.error('sla sweep', e.message); } }, 60000);

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => console.log(`Orbit API on http://localhost:${PORT}`));
