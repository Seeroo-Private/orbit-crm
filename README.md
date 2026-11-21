# Orbit CRM

A multi-tenant lead-to-cash CRM + task manager. Feature clone of the Progbiz spec with an original design.

## Run

```bash
npm install
npm run seed     # (re)creates demo data
npm run dev      # API :4100 + web :5180
```

Open http://localhost:5180 — company **DEMO**, `admin / admin123`
(also `priya`, `rahul`, `anita`, `vikram` / `demo123`; the plan allows 8 seats).

`npm run build && npm start` serves the built web app from the API on :4100.

## Stack
- `apps/api` — Node 22, Express, better-sqlite3, JWT, bcrypt
- `apps/web` — Vite + React 18, react-router, lucide-react, hand-made SVG charts, plain CSS (light/dark, EN/AR RTL)

## What's covered
- **Auth & tenancy**: company code login, seat limits, role permissions (54), hierarchy-scoped data
- **CRM**: enquiries (settings-driven form), list/board, follow-up agenda, lead detail, transfer, bulk actions, customers (+change approvals), quotations (print), sales targets, lead expenses, source commission with TDS, AI call analysis
- **Tasks**: week board with drag to reschedule, instant/later/repeat, timer (start/hold/resume/end), checklist, notes, predefined tasks, dashboard, team, to-do, timeline, calendar & leaves
- **Insights**: CRM dashboard (7 tabs), executive scores, forecast, 20 reports with CSV, custom reports
- **Team**: chat, mail, rule-based AI assistant, attendance, locations, notifications, Ctrl+K palette
- **Admin**: masters, users & reporting tree, access roles matrix, enquiry/quotation/company settings, SLA, CSV import, AI tokens, billing, audit log, support

AI features (assistant, call analysis) are simulated with heuristics; payments/WhatsApp/email delivery are integration points.
