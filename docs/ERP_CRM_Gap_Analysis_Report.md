# ERP & CRM Platform — Document Analysis and Gap Analysis Report

**Date:** 18 Nov 2026
**Sources analysed**
- **Doc A** — *Logic Technology ERP & CRM — System Documentation* (PDF, 34 pp.)
- **Doc B** — *Progbiz CRM — Feature Clone Specification* (DOCX, 15 sections)

**Status:** Analysis only. Neither source document was modified; no implementation has started.
**Priority key:** **H** = needed before the platform can be built or sold as generic; **M** = needed for a competitive first release; **L** = later / optional.

---

## 1. Executive summary

The two documents are complementary but describe two different products.

| | Doc A (Logic Technology) | Doc B (Progbiz clone) |
|---|---|---|
| Nature | Vertical, solar/CCTV sales-install-service business | Horizontal lead/task CRM SaaS, observed from a live tenant |
| Strength | Deep ERP: inventory with serials, purchase, sales, installation projects, field service/dispatch, accounting, GST | Deep, *configurable* CRM: lead statuses/stages/sources, follow-ups, SLA, targets, automation, tasks, access-role grid, tenant settings engine |
| Weakness | CRM pipeline is hard-coded; roles are fixed; nothing can be switched off; no HR/payroll; India/solar assumptions everywhere | No finance, inventory, purchase, invoicing or real HR; single pipeline; automation only sends messages; unverified in key areas (its §15) |

**Headline findings**

1. **Neither document describes a modular platform.** Doc A is a "modular monolith" whose modules are hard-wired to each other (Accounts auto-posts from every module; Service reads Assets, Stock, Rate cards). Doc B is multi-tenant and settings-driven but has no concept of installable modules. The *platform core* (module registry, dependency rules, metadata/custom-field engine, workflow engine) is the largest missing piece and must be designed first.
2. **The best CRM = Doc B's configurability + Doc A's quotation→order→asset→service chain.** Combined, CRM coverage is good; individually, each leaves ~half of the nine requested CRM capabilities only partial.
3. **HR & Payroll is a direct conflict.** Doc A excludes payroll from phase 1 and offers only "HR-lite" in phase 2. Doc B has leave/attendance/payroll *defaults* but no salary engine. The brief requires employee records, attendance, salary calculation and payment tracking now (recruitment excluded). This is a **full gap (H)**.
4. **Doc B's "clone" framing is a risk.** It asks for a "functionally identical product" to a commercial SaaS. Use it as a *capability checklist*, not a copy target (see §10, item 14).
5. **Doc A is solar/CCTV- and India-specific in places that must become configuration, not code**: GST/HSN/e-invoice, TDS, DISCOM/net-metering, kW sizing, camera-point sizing, INR.
6. **Both documents contain internal inconsistencies and undecided business rules** that must be resolved before design (§8).

**Recommended direction:** Build a **Platform Core** + **independent business modules** + **Industry Packs** (Solar/CCTV becomes the first pack: pipeline, fields, checklists, rate cards, sizing helpers). Priority gaps are listed in §6 and the roadmap in §13.

---

## 2. Analysis of the source documents

### 2.1 Doc A — Logic Technology ERP & CRM

**Scope & intent.** One platform for buy → stock → sell → install → service (for years). Every sale becomes a serial-tracked **Asset** that anchors warranty, AMC and service. Differentiator: Uber-style technician dispatch. Five front ends (customer app/portal, technician app, partner app, web ERP, WhatsApp bot) on one API/DB.

**Modules described**

| Module (section) | What it covers | Depth |
|---|---|---|
| Roles & permissions (§3) | 11 fixed roles, branch scoping, C/R/U/A matrix, second-approver rules, audit log, call masking | Good, but roles are hard-coded |
| CRM (§5) | Customer profile/360, lead sources, auto-assign, follow-ups, scoring, enquiry + site survey, quotation (versioned, approval, OTP/e-sign), communication timeline, 6-stage pipeline, kanban, purchase/service history, upsell triggers | Good; stages/fields fixed |
| Inventory (§6) | Item master, kits/BOM, multi-warehouse/van/bins, serial/batch, dual warranty, FIFO/WAvg, barcode, reorder alerts, cycle counts, job consumption | Strong |
| Purchase (§7) | Supplier master, PR→RFQ→PO→GRN→3-way-match bill, landed cost, TDS, price history | Strong |
| Sales (§8) | Quote→order→invoice, stock reservation, milestone billing, GST e-invoice/e-way, delivery, targets, commission | Strong |
| Installation/projects (§9) | Teams, Gantt, tasks, checklists, cost sheet, customer approval → asset + warranty | Strong, but domain-specific |
| Service & dispatch (§10) | Booking, rules engine, matching/scoring, live tracking, warranty/AMC coverage, PM, SLA, rate cards, earnings, KPIs | Very strong, but narrow-vertical |
| Supplier & partner (§11) | Scorecards, partner onboarding, grading, settlements | Good |
| Accounting (§12) | COA, auto-posted journals, AR/AP, bank rec, GST/TDS, deferred AMC revenue, P&L/BS/TB, Tally/Zoho sync | Good for India |
| Reports (§13), events (§14), data model (§15), screens (§16), notifications (§17), APIs (§18), gaps (§19), NFR/roadmap (§20) | Full-spectrum | Good |

### 2.2 Doc B — Progbiz CRM clone spec

**Scope & intent.** Multi-tenant Lead/Sales CRM + Task Management with light HRMS, chat, mail, AI assistant and AI call analysis.

**Modules described**

| Module | What it covers | Depth |
|---|---|---|
| Platform (§2) | Tenant code, plan/seat limits, branches, online/offline switch for lead routing, audit (User Log), quick links, notifications, inline quick-add | Good |
| Home/Dashboards (§3–4) | Personal workspace; CRM dashboard (KPIs, tabs), executive performance, lead forecast, task dashboard | Good |
| CRM (§5) | Enquiry form, follow-ups (agenda/list/kanban), leads list/kanban, bulk transfer/re-open, quotation, payment-pending leads, AI call analysis, sales targets, lead expenses, source commission (TDS 194H), bulk task assignment | Very good (CRM breadth) |
| Tasks (§6) | Typed tasks, timers, checklists, delegation, repeat, predefined/templated tasks, calendar, work-flow records | Good |
| Master/settings (§7, §9) | Customers, users/levels/teams/departments, items, lead status/stage/source, automations & templates, custom fields, field-mapping tags, custom reports, tokens, billing | Good |
| Access control (§8) | 54 permissions in groups, role grid, data scope, hierarchy via level + Reports-To | Good |
| Other (§11) | Excel import, user locations, mail, chat, AI assistant, support desk, integrations (Meta, WhatsApp, Google), light HRMS | Mixed — HRMS and import are thin |
| Data model, phases, design direction, coverage notes (§12–15) | Core entities, 6 build phases | Good; §15 admits key flows were **not verified** |

### 2.3 How the two documents relate

| Topic | Doc A | Doc B | Conflict / resolution |
|---|---|---|---|
| Pipeline | Fixed 6 stages | Configurable statuses (with *nature*) + optional stages + nature + quality | Adopt B's configurability, simplify its four overlapping taxonomies (§5.1) |
| Roles | 11 fixed roles | Admin-defined access roles + 54-permission grid + hierarchy | Adopt B. Doc A's 11 roles become a *seed template* |
| Tenancy | Branch scoping now; `company_id` only "future" (§20.5) | Tenant is first-class | Tenant from day one (also contradicts A's own `branch_id`-only data model, §15) |
| Quotation | Versioned, approval, OTP accept, convert to order | Single version, no approval, "Quotation Conversion" report | Adopt A's lifecycle |
| Tasks | Only inside installation/service | Generic task engine | Adopt B as a core Task module; installation tasks reuse it |
| Customer types | Individual/business/institution/government | Individual/business + Suspect/Prospect/Customer level | Combine: type **and** lifecycle level |
| Automation | Event-driven notifications table (§17) | Trigger/medium/template messaging | Both are message-only → need a real workflow engine (§6, G-03) |
| HR | Payroll out of scope; HR-lite phase 2 | Leave/attendance/payroll defaults only | Both insufficient for the brief |
| Mobile | 3 mobile apps | Mobile app for calls/location | Reconcile (also A says "five" front ends in §2 and "three mobile apps" in §16 / "all three apps" in §18) |

---

## 3. Requirement coverage — CRM (Brief §2)

| # | CRM capability requested | Doc A | Doc B | Combined verdict | Priority |
|---|---|---|---|---|---|
| 1 | Lead management & tracking | Partial — sources, assign, follow-ups, scoring (§5.2) | Good — enquiry form, assignment rules, bulk transfer, re-open, dedupe-by-customer rule | **Covered** (needs duplicate *lead* merge, lead import/dedupe rules) | M |
| 2 | CRM pipeline management | Partial — 6 fixed stages, kanban (§5.5) | Partial — statuses + optional stages; single pipeline | **Partial** — no multi-pipeline, no stage entry/exit rules | **H** |
| 3 | Lead conversion & closure | Partial — converts to customer, quote→order | Partial — Won/Lost + reasons, payment-pending leads | **Partial** — no conversion mapping (lead→customer/deal/order) as configurable rule | **H** |
| 4 | Customer management | Good — types, sites, GSTIN, dedupe/merge, 360 | Good — individual/business, level, contacts, update-approval | **Covered** (union of both; add account hierarchy, tags, segmentation) | M |
| 5 | Enquiry management & follow-ups | Partial | Very good — agenda, missed/delayed, bulk lost | **Covered** (B) | M |
| 6 | Sales pipeline tracking | Good — value by stage, conversion by source | Good — KPIs, win/lost rate, forecast | **Covered**; needs stage probability + weighted forecast | M |
| 7 | Customisable workflows & stages | Missing | Partial — statuses/stages/sources/custom fields only for 4 entities | **Gap** — no workflow/state-machine designer | **H** |
| 8 | Interaction/communication history | Good — unified timeline, call recording link, logged notifications (§5.4) | Partial — timeline, calls, chat; no unified email sync | **Covered**; add email capture, per-contact consent log | M |
| 9 | Sales performance tracking & reporting | Good — targets, commission, avg discount | Very good — targets, exec score, source ROI, commission | **Covered** | M |

**CRM verdict:** content-wise ~70% present across both documents, but the **configurability requirement (items 2, 3, 7) is the real gap** — nothing defines *how* a business edits pipelines, stages, fields and rules without developers.

### 3.1 Specific CRM problems found

| # | Problem | Evidence | Fix | Priority |
|---|---|---|---|---|
| C1 | Four overlapping classifications on a lead: **Status** (Doc B §7), **Stage**, **Nature** (New/Warm/Hot/Super Hot/Won/Lost), **Quality** (Cold/Warm/Hot/Super Hot/Not Connected/Not Reachable) | "Warm/Hot/Super Hot" appear in both Nature and Quality; seeded statuses ("Proposal Sent", "Negotiation") duplicate stage names | One **pipeline → stages** (each with probability and *type* Open/Won/Lost) + one separate **temperature/rating** field + **contact outcome** (connected/not reachable). Remove "Nature" | **H** |
| C2 | No separate **Opportunity/Deal** — a Lead is both the unqualified contact and the sales deal | Doc B data model has `Lead` only | Model Lead → (qualify) → Opportunity/Deal, or make "lead = deal" an explicit config choice per pipeline | **H** |
| C3 | Single pipeline only | Doc A one stage list; Doc B one status list | Multiple pipelines per tenant (e.g., Product Sale, Installation, AMC Renewal, Service Upsell) | **H** |
| C4 | Won/Lost reasons exist, but no **required fields per stage** and no stage-change validations | Doc B §5.2 only | Gate rules ("cannot move to Proposal without a site survey") | M |
| C5 | Quotation: B lacks versioning/approval; A lacks currency, grouping, payment terms detail | A §5.3 vs B §5.4 | Merge: versioning, approval, currency, groups, payment terms, T&C, e-accept | M |
| C6 | Lead scoring is only mentioned (A §5.2); no scoring rule definition | — | Configurable rule-based score (fields, activity, response speed) | L |
| C7 | Dedupe is customer-level only; no lead-level duplicate detection beyond "block lead if open follow-up" | A §5.1, B §5.1 | Dedupe rules per entity, merge with audit | M |
| C8 | No **marketing** objects (campaigns, lists, email/WhatsApp broadcasts), although B has "Marketing View" | B §4.1 | Campaign entity linking source, spend, leads, ROI; broadcasts later | M |
| C9 | Lead capture channels listed but no inbound-form/API spec (website forms, ads, WhatsApp) | A §5.2, §18.2; B Meta | Define a Lead Capture connector interface (webhook + mapping) | M |
| C10 | Dealer / channel-partner concept appears (B "Need Dealer", A dealer portal phase 2) but is not modelled | — | Partner/Dealer as Party role; commission & portal later | L |

---

## 4. Requirement coverage — ERP (Brief §3)

Relevance is judged for a **generic multi-business platform**, not for solar only.

### 4.1 Finance & Accounting

| Capability | Doc A | Doc B | Gap | Priority |
|---|---|---|---|---|
| Chart of accounts, journals, cost centres, FY | Covered (§12.1) | Missing (but Excel import mentions Ledgers/Account Groups, implying a hidden module) | Need generic double-entry core, no India-only assumptions | **H** |
| Income & expense tracking | Auto-posted; technician expense claims | Lead expenses only | Need simple **income/expense (cash-book) mode** for businesses without full accounting | **H** |
| Accounts receivable | Strong (§12.2) | Payment-pending leads only | OK in A; make independent of Sales module | **H** |
| Accounts payable | Strong (§12.3) | None | Generalise supplier/partner/expense payables | **H** |
| Invoicing & payments | Strong, GST-specific | None | **Separate Invoicing from Accounting** so it works without the ledger; tax engine pluggable | **H** |
| Financial reports | P&L, BS, TB, cash flow, ageing | Sales reports only | Covered by A; add budgets, multi-currency | M |
| Tax/compliance | GST, TDS, e-invoice (India) | TDS on commission | Move behind a **Localisation Pack** (India first) | M |
| External accounting sync | Tally/Zoho (optional) | — | Keep as integration | L |

### 4.2 HR & Employee Management (scope: no recruitment)

| Capability | Doc A | Doc B | Gap | Priority |
|---|---|---|---|---|
| Employee records & profiles | "Employee/technician" shared master named (§14) but **no employee entity detail**; technician KYC/skills only (§10.2) | Users with designation, department, level, reports-to; employee code patterns | **No employee profile** (personal, job, documents, bank, emergency contact, statutory IDs, history) | **H** |
| Staff attendance | Geofenced attendance = HR-lite phase 2 (§19) | Attendance report, muster, leave/holiday/WFH/weekly off (high-level) | Need attendance capture (manual/mobile/geofence), shifts, regularisation, overtime | **H** |
| Leave | Mentioned (leave clashes in scheduling) | Leave/holiday calendar | Leave types, balances, accrual, approvals | **H** |
| Salary structure & calculation | **Out of scope phase 1** (§1) | "Payroll defaults", "Default CTC basis" only | Salary components, earnings/deductions, attendance-linked pay, variable pay, payslips | **H** |
| Payment tracking | Partner/technician payouts only | None | Payroll run → approval → payment status, advances, loans, recoveries | **H** |
| Staff income/expense | Technician expense claims, cash-in-hand ledger, per-job earnings, sales commission | Lead-source commission | Staff expense claims, advances, incentives/commission feeding payroll | M |
| Statutory (PF, ESI, PT, TDS on salary) | Missing | Statutory IDs stored only | Localisation pack | M |
| Recruitment | Not mentioned | Not mentioned | **Out of current scope — future phase** | Future |

### 4.3 Other ERP components

| Module | Doc A | Doc B | Relevant for generic platform? | Gap / action | Priority |
|---|---|---|---|---|---|
| Inventory | Strong | Items only (CRM catalogue); opening-stock import hints at a hidden module | Optional (traders, field service, manufacturers) | Keep as independent module; make serial/batch/BOM *options* | M |
| Purchase | Strong | None | Optional | Independent; depends only on Items + Parties | M |
| Sales (quote→order→invoice) | Strong | Quotation only | Core for most businesses | Split: CRM owns *quote*, Sales owns *order/delivery*, Invoicing owns *invoice* | **H** |
| Product & service catalogue | Item master (products, services, kits) | CRM Items (name, code, price) | Core | **One shared Catalogue** (product / service / bundle) used by every module | **H** |
| Vendor/supplier mgmt | Strong (scorecards) | None | Optional | Generic **Party** (customer/vendor/partner roles) | M |
| Customer support & maintenance | Very strong (service, SLA, AMC, warranty) but dispatch-centric | Support-complaint desk only to Progbiz vendor | Common (helpdesk) vs. specialised (field service) | Split into **Helpdesk/Tickets** (generic) and **Field Service & Assets** (extends it). A's "Helpdesk" is deferred to phase 2 (§19) — wrong order, since service tickets underpin both | **H** |
| Project & task management | Installation projects; task list within projects | Task Mgmt strong | Common | Generic **Tasks** (core) + **Projects** (optional, with cost sheets) | M |
| Reports & analytics | Strong (§13) | Strong + custom report builder | Core | Reporting engine + report builder, not per-module hard-coded reports | **H** |
| Document management | "Document/Attachment" polymorphic link only | Attachments in tasks/chat | Core | Central Document service: versions, folders, expiry, e-sign, templates | M |
| Notifications & workflow automation | Notification matrix (§17) | Automations (message-only), SLA rules | Core | Unified **workflow/rules engine** (trigger → condition → actions) | **H** |
| Asset registry | "Must" in §19 yet already the pivot of §15 | — | Optional/vertical | Separate Assets module (customer-owned *and* company-owned assets) | M |
| Contracts/AMC/subscriptions | AMC | — | Common (recurring services) | Generic **Contracts & Recurring Billing** | M |
| Communication (mail/chat/WhatsApp) | WhatsApp/SMS/email notifications | Mail, chat, WhatsApp | Optional | Communication Hub module; internal chat/mail is **L** | L |
| Dealer/partner portal | Phase 2 | — | Optional | Future | L |
| Multi-company/franchise | Future (§20.4), though §20.5 already mentions `company_id` | Tenant model | Core to architecture | Must be a day-one design decision | **H** |

---

## 5. Gap analysis at every level

### 5.1 Functionality — covered, partial, missing

**Correctly covered (reusable almost as written)**
- Doc A: item/serial/batch inventory (§6); procure-to-pay with 3-way match (§7); order-to-cash, milestone invoicing, commissions (§8); installation project costing and approval (§9); warranty/AMC coverage logic (§10.4); partner settlement (§11.4); auto-posted accounting with deferred AMC revenue (§12); event table (§14); NFRs (§20.1).
- Doc B: access-role grid and hierarchical data scope (§8); tenant settings engine with per-setting save (§9.1); lead status/source masters; SLA with escalation and auto-reassign; follow-up agenda; targets; lead expenses and source ROI; audit log; inline quick-add; import template/history pattern.

**Partially covered**
- Customisable pipelines/fields (B covers 4 entities only; no per-stage fields, conditional logic, validation, or field-level permissions).
- Automation (messaging only; no create-record, update-field, assign, webhook, or approval actions).
- Reporting (fixed lists + custom report builder in B, but no semantic layer, scheduled delivery spec only in A).
- Document templates (B has "Field Mapping tags"; A has PDF only). Need a template designer.
- Approval workflow (A: discounts, POs, write-offs; B: transfers with "optional approval chain"). Needs one generic approval engine.
- Data import/export (B: entity list incomplete; no export-for-migration spec).
- Localisation (A: INR/GST only; B: EN/AR + RTL, INR).

**Missing entirely**
- Module registry / manifest / dependency graph / activation lifecycle.
- Metadata engine (custom entities, forms, layouts, validations).
- Workflow/state-machine designer.
- Employee profile, salary engine, payroll run, attendance engine.
- Generic income/expense (simple books) mode.
- Multi-currency and multi-company reporting consolidation.
- Public API/webhook spec for third-party extensions; module SDK.
- Data migration, backup/restore per tenant, tenant provisioning, licensing/plan-to-module mapping.
- Observability, rate-limiting, API versioning policy for module APIs.
- Global search and a unified Party (contact) model.
- Security model beyond RBAC: field-level permission, record-level sharing rules, IP/2FA/SSO.

### 5.2 Incorrect, incomplete or unclear requirements

| # | Document | Issue | Why it matters | Resolution | Priority |
|---|---|---|---|---|---|
| R1 | A §1 vs brief | "Payroll out of scope" | Conflicts with HR requirement | Include basic payroll in current scope | **H** |
| R2 | A §15 vs §20.5 | Data model says `branch_id` on every table; scalability section says "multi-tenant ready (`company_id`)" and §20.4 calls multi-company a *future enhancement* | Retro-fitting tenancy is expensive; "ready" is not designed | `tenant_id` + `branch_id` from day one, row-level isolation | **H** |
| R3 | A §2 | Lists five front ends; §16 "three mobile apps"; §18 "all three apps and web ERP" | Scope of delivery unclear | Define app inventory once | M |
| R4 | A §19 | "Asset registry as its own module" and "Site survey module" are Must-haves, but both are already specified (§5.3, §15) | Duplicated requirement, unclear whether new work | Merge into main sections; keep Assets as an optional module | M |
| R5 | A §19 | Helpdesk/complaints is **Should (phase 2)**, yet service tickets and low-rating quality tickets (§10.7) are phase-1/2 flows | Dependency inverted | Make Ticketing a core of Service | **H** |
| R6 | A §20.3 | Accounts core in phase 1, dashboards in phase 3, while objective 7 is "real-time management visibility" | Objectives not traceable to roadmap | Basic dashboards in the same phase as CRM | M |
| R7 | A §3 | Fixed role list and permission matrix hard-coded | Cannot serve other businesses | Treat as seed data; roles are admin-defined | **H** |
| R8 | A §10.3 | Dispatch weights sum: 40+? ... PDF table is ambiguous (skill match listed without a weight in extracted text); tunable | Cannot validate algorithm spec | Confirm weights table; test with sample data | L |
| R9 | A §19 | Open business rules (warranty start, visit charge, partner split, cancellation fee, SLA targets, valuation method, books in-ERP vs Tally) | Block design of finance, service and pricing | Resolve with client before build | **H** |
| R10 | B §15 | Saving a lead, lead detail, quotation PDF, kanban, follow-up modal, reports, automation and user forms **not verified**; only one seat in test tenant | Core CRM behaviour is inferred from release notes | Treat as hypotheses; define our own behaviour | **H** |
| R11 | B §11 | Import lists Ledgers, Suppliers, Opening Stock → implies accounting/inventory exist but are not specified | Hidden scope, wrong assumption that product is "CRM only" | Do not rely on Doc B for any ERP behaviour | M |
| R12 | B §5.1 | Rule "block new lead for customer with an open follow-up" is hard-coded as setting, no exception handling (e.g., different product line) | Loses legitimate leads | Make rule scoped by product/pipeline | M |
| R13 | B §7 | User Levels fixed to four named levels with "department required" | Not generic | Levels = configurable hierarchy | M |
| R14 | B §14 | Asks for functionally identical clone of a commercial SaaS | Legal/IP risk; locks product into another vendor's design | Use as capability reference; original naming, data model and workflows (it already requires original visuals) | **H** |
| R15 | B §15 | Test records remain in vendor tenant (HAVALA) | Housekeeping/privacy | Delete as noted | L |
| R16 | Both | No glossary: Lead vs Enquiry vs Opportunity; Customer vs Party; Task vs Job vs Ticket vs Project | Naming drives schema | Single glossary (§9.3) | M |
| R17 | Both | No data-retention, consent, DPDP/GDPR handling beyond A §20.1 line | Compliance risk | Add privacy requirements per module | M |
| R18 | Both | Non-functional targets exist only in A and only for service/dispatch | Platform-wide SLOs missing | Define for core platform | M |

### 5.3 Architecture gaps

| # | Gap | Evidence | Recommendation | Priority |
|---|---|---|---|---|
| AR1 | No module registry, manifest, versioning, lifecycle | Neither doc | See §9.1–9.3 | **H** |
| AR2 | Modules are coupled via **shared tables and hard-wired event consumers** (§14 of A: e.g., "Sales order short of stock → Purchase request") | A | Consumers must be optional subscriptions registered by the consumer module; absence of consumer = event ignored | **H** |
| AR3 | Accounts assumed to receive journals from *every* module | A §12 | Finance **subscribes** to "financial events" published by other modules through a posting adapter; no financial event → no coupling | **H** |
| AR4 | Cross-module foreign keys (SalesInvoice → Asset → Warranty → ServiceRequest) | A §15 | Use shared-kernel IDs (Party, Item, Document) and soft references (type+id) between optional modules | **H** |
| AR5 | No metadata/customisation layer | A none; B partial | Metadata engine (§9.4) | **H** |
| AR6 | No workflow/rules engine | A none; B messages only | Generic rule engine with triggers, conditions, actions, approvals, SLA timers | **H** |
| AR7 | Single "modular monolith" recommended; no module boundary enforcement rules | A §20 | Enforce with package boundaries + contract tests + dependency lint | M |
| AR8 | No licensing/plan mapping (module ↔ plan ↔ seats) | B has plans/seats only | Entitlements service | M |
| AR9 | Localisation hard-coded (GST, HSN, TDS, DISCOM) | A | Localisation packs | M |
| AR10 | No extension points for 3rd parties (custom actions, webhooks, scripts) | Both | Webhooks, API tokens, later a scripting/plugin sandbox | L |
| AR11 | Realtime/dispatch requirements shape the whole stack (WebSocket, PostGIS, Redis) even for businesses without field service | A §2 | Keep geospatial/dispatch infrastructure inside the Field Service module only | M |

---

## 6. Comparison table — module / feature gaps

| Module / Feature | Existing coverage | Identified gap | Recommended improvement | Priority |
|---|---|---|---|---|
| **Module registry & lifecycle** | None | No install/enable/disable/uninstall, no dependency graph | Module manifest + registry + activation service; dependency-aware enable/disable | **H** |
| **Tenant / company model** | B: tenant + branch; A: branch + "future" company_id | A late; no multi-company | `tenant_id` + `company_id` + `branch_id` from start | **H** |
| **Metadata engine (custom fields/forms)** | B: custom fields on 4 entities | No validations, conditional visibility, formula, per-stage fields, on non-CRM entities | Field engine for any entity; layouts; validations; field-level permissions | **H** |
| **Workflow / automation engine** | B: message automations; A: notification matrix | No conditions, actions beyond send, approvals, timers; no visual designer | Trigger–condition–action engine incl. approvals & SLA timers | **H** |
| **Pipeline management** | A: fixed stages; B: statuses/stages | Single pipeline; 4 overlapping taxonomies; no stage rules | Multiple pipelines; stage type/probability/gates/required fields | **H** |
| **Lead → customer → order conversion** | A: auto-create customer; B: Won/Lost | Conversion mapping not configurable; no Opportunity entity | Configurable conversion map; optional Deal entity | **H** |
| **Quotation** | A: versioned, approvals, OTP; B: basic | Not unified; no templates designer | One quotation lifecycle + template designer | M |
| **Customer / Party master** | A: customer, supplier, partner, employee as separate masters; B: customer | No unified party/contact; duplicate contacts across roles | Party with roles + contacts + addresses + consents | **H** |
| **Roles & permissions** | A: fixed roles; B: grid, scope | A hard-coded; no field-level, no record sharing rules; no module-level toggle | Admin-defined roles; module-scoped permissions auto-registered by manifests | **H** |
| **Audit trail** | A: audit all writes; B: add/edit log | Delete/view audit, field-level diff, export | Field-level change log; retention | M |
| **Finance (core)** | A: full India-centric | Not independent of other modules; no simple mode | Ledger core + posting adapters; "simple books" mode | **H** |
| **Invoicing** | A: GST invoicing inside Sales/Service | Tied to Sales; India-only tax | Separate Invoicing module with pluggable tax engine | **H** |
| **HR – employee records** | A: technician profile only; B: user + designation | No employee master | Employee module (profile, documents, org chart, history) | **H** |
| **HR – attendance & leave** | A: HR-lite phase 2; B: report + calendars | No engine | Attendance, shifts, leave types/balances/approvals | **H** |
| **HR – payroll** | A: out of scope; B: defaults | No salary structure, run, payslip, payment tracking | Payroll module (components, run, payslip, payments, advances/loans) | **H** |
| **Staff incentives/commission** | A: technician earnings, sales commission; B: source commission | Not unified; no path into payroll or payables | Incentive/commission rules → payroll or AP | M |
| **Inventory** | A: strong | Coupled to sales/service/projects | Independent module with optional serial/batch/BOM/valuation | M |
| **Purchase** | A: strong | Coupled to accounts, inventory | Independent; optional inventory/accounts links | M |
| **Product & service catalogue** | A item master; B CRM items | Two catalogues | One catalogue (product/service/bundle) | **H** |
| **Helpdesk / tickets** | A: service request; complaints deferred | No generic ticket; wrong phase | Generic Helpdesk core; Field Service extends it | **H** |
| **Field service & dispatch** | A: very strong | Vertical; heavy infrastructure | Optional module with own tech stack bounds | M |
| **Assets / warranty / AMC** | A: strong | Solar-shaped; entangled | Assets + Contracts modules, optional | M |
| **Projects / installation** | A: strong | Domain checklists baked in | Projects module; checklists via templates | M |
| **Tasks** | B: strong | Only in B, not integrated with A | Core Task service reused by all modules | M |
| **Documents** | A: attachments; B: attachments | No document module/versions/templates/e-sign | Documents service | M |
| **Reporting & dashboards** | A: fixed lists; B: fixed + builder | No shared reporting engine, no permissions on reports | Report engine, saved views, scheduled delivery | **H** |
| **Notifications / communication** | A: matrix; B: bell + automations | No central channel service, preferences, quiet hours | Notification service + templates + consent | M |
| **Integrations & API** | A: REST + providers; B: Meta/WhatsApp/Google | No public extension model | API versioning, webhooks, connector SPI | M |
| **Data import / export / migration** | B: template import | Limited entities; no export/migration | Generic import mapper; per-module import contracts | M |
| **Localisation** | A: India; B: EN/AR | India hard-coded | Packs: tax, currency, language/RTL, formats | M |
| **Marketing** | B: lead expenses, source ROI | No campaigns/broadcasts | Campaign entity; later broadcast module | L |
| **AI features** | B: assistant, call analysis | Out of core scope; token economy undefined | Treat as add-on module | L |
| **Chat / internal mail** | B | Not core ERP; heavy | Optional or integrate external | L |
| **Billing/licensing** | B: plan, seats, tokens | No module entitlements | Entitlement service | M |
| **Security & compliance** | A: TLS, RBAC, DPDP | No 2FA/SSO policy, retention, encryption key mgmt | Security baseline per tenant | M |
| **Recruitment** | — | — | **Future phase** | Future |

---

## 7. Recommended additional ERP and CRM modules

**Mandatory platform services (not user-facing modules, but required)**
1. Tenant & organisation (company, branch, department, team, hierarchy)
2. Identity & access (users, roles, permissions, scopes, 2FA/SSO)
3. Module manager (registry, activation, dependencies, entitlements)
4. Metadata engine (custom fields, forms, layouts, validations)
5. Workflow & automation engine (rules, approvals, SLA timers, scheduler)
6. Notification & communication service (email, SMS, WhatsApp, push, templates, consent)
7. Document & template service
8. Audit & activity timeline
9. Import/export & integration gateway (REST, webhooks)
10. Reporting & dashboard engine
11. Master data kernel: **Party**, **Catalogue (Item)**, **Tax**, **Currency**, **UOM**

**Business modules (each independently enable-able)**

| Module | Core of | Needed for current scope? |
|---|---|---|
| CRM (leads, deals, pipelines, quotations, follow-ups, targets) | CRM | **Yes** |
| Customer & Party | CRM | **Yes** |
| Tasks & Calendar | CRM/Ops | **Yes** |
| Sales (orders, delivery) | ERP | Yes (solar) |
| Invoicing & Payments | ERP | **Yes** |
| Finance & Accounting (incl. simple income/expense mode) | ERP | **Yes** |
| HR: Employee, Attendance & Leave | ERP | **Yes** |
| HR: Payroll | ERP | **Yes** |
| Inventory | ERP | Yes (solar) |
| Purchase & Vendors | ERP | Yes (solar) |
| Helpdesk / Tickets | Support | Yes |
| Projects (installation) | Ops | Yes (solar) |
| Assets, Warranty & Contracts (AMC) | After-sales | Yes (solar) |
| Field Service & Dispatch | After-sales | Phase 2 (solar differentiator) |
| Reports & Dashboards | Core | **Yes** |
| Documents | Core | Phase 2 |
| Marketing / Campaigns | CRM ext. | Later |
| Dealer / Partner portal, Customer portal | Ext. | Phase 2–3 |
| Recruitment | HR ext. | **Future** |
| AI assistant / call analysis, IoT connectors | Add-ons | Future |

---

## 8. Business rules to confirm before design

From Doc A §19: warranty start date; visit-charge policy; partner split and settlement frequency; cancellation fee; service radius/SLA per zone; stock valuation (FIFO/WAvg); statutory books in this ERP or Tally/Zoho.

**Additional rules this analysis raises**

| # | Question | Impacts |
|---|---|---|
| Q1 | Do all businesses use the same lead pipeline structure, or is every pipeline admin-defined? (assumed: admin-defined) | CRM |
| Q2 | Is a Lead the same as a Deal, or should qualification create a separate Deal? | CRM, reporting |
| Q3 | Which country/tax regimes beyond India are needed in the first release? | Localisation |
| Q4 | Should Finance be full double-entry for every tenant, or can small tenants use simple income/expense? | Finance |
| Q5 | Payroll scope: salary computation only, or also statutory filings and bank file export? | HR |
| Q6 | Is technician "earnings" paid through payroll (employees) or payables (partners)? | HR/Finance |
| Q7 | Who owns the invoice when Sales is disabled but CRM and Finance are on (e.g., service-only business)? | Architecture |
| Q8 | Is multi-company within one tenant required, or only multi-branch? | Architecture |
| Q9 | SaaS (many tenants, shared DB) or per-client deployment? | Infrastructure |
| Q10 | Is the Doc B reference a feature checklist or an obligation to mimic Progbiz screens? | Legal |

---

## 9. Recommended modular architecture

### 9.1 Layered structure

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Industry Packs (config bundles)  Solar/CCTV · Retail · Services · Mfg …   │
│  pipelines · custom fields · templates · checklists · rate cards · reports │
├───────────────────────────────────────────────────────────────────────────┤
│ Business Modules (independently enable-able)                              │
│ CRM · Sales · Invoicing · Finance · Inventory · Purchase · HR · Payroll   │
│ Helpdesk · Projects · Assets/Contracts · Field Service · Documents · …    │
├───────────────────────────────────────────────────────────────────────────┤
│ Platform Core                                                             │
│ Tenant/Org · Identity & Access · Module Manager · Metadata Engine ·       │
│ Workflow/Rules · Notifications · Audit · Reports · API/Webhooks · Files   │
├───────────────────────────────────────────────────────────────────────────┤
│ Shared Kernel (data owned by core, read by all)                           │
│ Party · Catalogue Item · Tax · Currency · UOM · Employee-reference        │
└───────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Module manifest (every module declares)

| Manifest field | Purpose |
|---|---|
| `id`, `version`, `owner` | Identity and compatibility |
| `requires` (hard) | Modules that must be active; **kept to a minimum — ideally only Platform Core and Shared Kernel** |
| `optional` | Integrations enabled only when the other module is active (e.g., CRM shows stock availability only if Inventory is on) |
| `entities` / migrations | Tables and schema owned by the module |
| `permissions` | Registered automatically into role grid |
| `menus`, `settings`, `dashboard widgets`, `reports` | UI contributions registered on activation |
| `events.publishes` / `events.subscribes` | Public contract; versioned |
| `extension points` | Where other modules/packs may add fields, actions, tabs |
| `data lifecycle` | What happens on disable vs uninstall (retain, archive, delete) |

### 9.3 Rules that make "disable without breaking" true

1. **Disable ≠ uninstall.** Disable hides UI, stops event subscriptions and scheduled jobs; data is retained. Uninstall is a separate, confirmed, reversible-by-restore operation.
2. **No hard foreign keys across business modules.** Use shared-kernel IDs (Party, Item) or soft references (`ref_type`, `ref_id`). Modules never join each other's tables; they use published queries/events.
3. **Publishers don't know consumers.** Events such as `invoice.issued`, `stock.low` are fire-and-forget. If Finance is off, nobody posts journals; if Purchase is off, a low-stock event only raises a notification.
4. **Dependency check on toggle.** Enabling auto-enables hard requirements; disabling is blocked (with a list) if an active module hard-requires it.
5. **Capability detection in UI.** A module asks the manager "is capability X available?" rather than importing another module. Missing capability → feature hidden, not error.
6. **Orphan-safe data.** References to a disabled module's records display as "unavailable (module disabled)", never as errors.
7. **Per-module permissions, menu entries, custom fields, workflows and reports are deactivated with the module and reactivated unchanged.**
8. **Settings are namespaced per module and versioned**; module upgrades migrate its own data only.
9. **Contract tests in CI**: every module is tested with all optional modules off.

### 9.4 Customisation layer (plug-and-play)

| Capability | Design |
|---|---|
| Custom fields | Any entity; types (text, number, date, select, multi-select, lookup, formula, file); validations; conditional visibility; section/layout; field-level permission |
| Forms & layouts | Per role/branch/pipeline; required-ness by stage |
| Pipelines | Many per tenant; stages with type (Open/Won/Lost), probability, required fields, entry/exit rules, SLA per stage |
| Workflows | Triggers (event, schedule, field change) → conditions → actions (notify, assign, create record, update field, call webhook, request approval); visual builder; test/dry-run; run history |
| Approvals | One engine for discounts, POs, write-offs, transfers, leave, payroll |
| Roles & permissions | Admin-defined; module permissions auto-listed; data scope (own/team/branch/all); field-level; record sharing |
| Document templates | Designer with merge fields for quotations, invoices, payslips, reports |
| Industry packs | Importable bundle (pipelines, fields, templates, checklists, rate cards, sample reports) — **Solar/CCTV is Pack #1** |
| Localisation packs | Tax regime, currency, number/date formats, statutory reports, language/RTL |

### 9.5 Module dependency & integration matrix

`H` = hard dependency (cannot be enabled alone) · `O` = optional integration · `—` = none.
Rows depend on columns. **Core** = Platform Core + Shared Kernel (always present).

| Module ↓ depends on → | CRM | Sales | Invoic. | Finance | Inventory | Purchase | HR | Payroll | Helpdesk | Projects | Assets | Field Svc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **CRM** | — | O | O | — | O (availability) | — | O (users) | — | O | — | O | — |
| **Sales** | O (quote) | — | O | O | O | O | — | — | — | O | — | — |
| **Invoicing** | O | O | — | O (postings) | — | — | — | — | O | O | — | — |
| **Finance** | — | — | O | — | O | O | O | O | — | — | — | — |
| **Inventory** | — | O | — | O | — | O | — | — | — | O | O | O |
| **Purchase** | — | O | O | O | O | — | — | — | — | O | — | — |
| **HR** (employee/attendance/leave) | — | — | — | — | — | — | — | — | — | — | — | O |
| **Payroll** | — | — | — | O | — | — | **H** | — | — | — | — | O |
| **Helpdesk** | O | — | O | — | — | — | O | — | — | — | O | — |
| **Projects** | O | O | O | O | O | O | O | — | — | — | O | — |
| **Assets/Contracts** | O | O | O | — | O | — | — | — | O | O | — | — |
| **Field Service** | O | — | O | O | O | — | O | O | **H** | — | **H** | — |

Only three hard dependencies remain: **Payroll → HR**, **Field Service → Helpdesk + Assets**. Everything else is optional integration, which is what allows "CRM + Finance + HR" or "CRM only" bundles.

### 9.6 Typical bundles

| Business | Modules |
|---|---|
| Services company, no stock | CRM, Invoicing, Finance, HR, Payroll, Tasks |
| Trader | CRM, Sales, Inventory, Purchase, Invoicing, Finance |
| Solar/CCTV installer (Logic Technology) | CRM, Sales, Inventory, Purchase, Invoicing, Finance, Projects, Assets/Contracts, Helpdesk, Field Service, HR, Payroll |
| CRM-only business | CRM, Tasks, Reports |
| Finance disabled | Invoicing keeps working (issues and tracks payments); journals are not posted |

### 9.7 Cross-cutting technical recommendations

- **Tenancy:** `tenant_id` (row-level security) + `company_id` + `branch_id` on all transactional tables; per-tenant encryption options.
- **Event bus:** outbox pattern so events survive failures; versioned event schemas; idempotent consumers.
- **Keep dispatch/tracking infrastructure** (PostGIS, Redis GEO, WebSocket gateway) **inside Field Service only**; do not make it a platform requirement.
- **API:** versioned REST, module-prefixed routes, webhooks, API tokens, rate limits.
- **Search:** one search index over entities flagged searchable by active modules.
- **Reporting:** read model per module registered with the report engine; permissions inherited.
- **Stack:** Doc A's NestJS/Django + PostgreSQL + Redis + queue + React + Flutter is compatible; module boundaries must be enforced in code (package-level) from the first commit.

---

## 10. Recommendations for improvement (consolidated)

| # | Recommendation | Source of gap | Priority |
|---|---|---|---|
| 1 | Design Platform Core (module manager, tenant, metadata, workflow, permissions) before any business module | AR1–AR6 | **H** |
| 2 | Redesign CRM around **configurable pipelines** (multiple, stage rules, probability) and collapse Status/Stage/Nature/Quality into one coherent model | C1–C3 | **H** |
| 3 | Decide Lead vs Deal vs Opportunity | C2, Q2 | **H** |
| 4 | Introduce **Party** and **Catalogue** shared kernels | §6 | **H** |
| 5 | Split Invoicing from Finance and Sales; keep Finance optional | AR3, §4.1 | **H** |
| 6 | Add HR (employee, attendance, leave) and Payroll to current scope, exclude recruitment | R1, §4.2 | **H** |
| 7 | Promote Helpdesk/Tickets to phase 1; Field Service extends it | R5 | **H** |
| 8 | Replace fixed roles with admin-defined roles; keep Doc A's roles as a seed template | R7 | **H** |
| 9 | Adopt a single approval engine | §5.1 | M |
| 10 | Move India/solar specifics (GST, HSN, TDS, DISCOM, kW sizing) into Localisation and Industry packs | AR9 | M |
| 11 | Resolve the open business rules (§8) with the client before data-model freeze | R9 | **H** |
| 12 | Align roadmap with objectives (dashboards early; Accounts not before invoicing basics) | R6 | M |
| 13 | Specify a unified document/template designer and reporting engine | §6 | M |
| 14 | Treat Doc B as a capability reference only; write original behaviour, naming and templates; confirm legal position on the "identical clone" goal | R14 | **H** |
| 15 | Verify unverified Doc B behaviours (lead save/detail, quotation PDF, kanban, follow-up modal, reports) through our own design rather than copying | R10 | M |
| 16 | Define platform-wide NFRs (performance, availability, backup, privacy) | R17, R18 | M |
| 17 | Write a glossary and naming standard | R16 | M |

---

## 11. Current requirements vs. future enhancements

| Category | Items |
|---|---|
| **Current (build now)** | Platform Core; CRM (customers, leads, configurable pipelines, follow-ups, quotations, targets, reports); Tasks; Catalogue & Party; Sales & Invoicing; Finance (incl. simple mode); Inventory & Purchase; HR (employee, attendance, leave); Payroll; Helpdesk; Roles/permissions; Reports & dashboards; Notifications; Solar/CCTV pack; India localisation |
| **Phase 2** | Field Service & dispatch, customer/technician/partner apps, Assets/AMC/warranty/RMA, Projects/installation (if not needed for first go-live), Documents, WhatsApp automation, Meta/Google lead capture, subsidy/net-metering tracker, dealer portal |
| **Phase 3** | Marketing campaigns, loyalty/referral, knowledge base, remote diagnosis, advanced analytics/forecast, expense & fleet tracking |
| **Future** | **Recruitment & onboarding**, AI assistant/call analysis, IoT/inverter/NVR integration, predictive maintenance, dynamic pricing, route optimisation, marketplace mode, franchise/multi-company consolidation, internal chat/mail, plugin SDK/marketplace, performance appraisal, learning/training, expense OCR |

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Building Doc A as-is hard-wires solar/India logic | Platform cannot serve other businesses | Packs + localisation from day one |
| Building Doc B as-is clones another vendor's product | Legal/IP and product-differentiation risk | Capability reference only |
| Late tenancy/module decisions | Expensive re-architecture | Decide in design phase |
| Over-engineering the metadata/workflow layer | Delays | Ship a thin version for CRM first, extend per module |
| Scope creep from "everything optional" | Test matrix explodes | Defined bundles + contract tests with optional modules off |
| Open business rules unresolved | Rework in finance/service | Close §8 questions first |

---

## 13. Suggested delivery sequence

| Stage | Scope |
|---|---|
| 0 — Decisions | Resolve §8 questions, glossary, legal position on Doc B, module list |
| 1 — Platform Core | Tenant/org, identity & permissions, module manager, metadata engine (basic), workflow engine (basic), audit, notifications, import/export |
| 2 — CRM + Tasks + Party/Catalogue | Configurable pipelines, leads, follow-ups, quotation, targets, dashboards; Solar/CCTV pack v1 |
| 3 — Sales, Invoicing, Finance | Orders, invoicing, payments, AR/AP, simple books, ledger posting adapter |
| 4 — HR & Payroll | Employee, attendance, leave, salary structure, payroll run, payslips, payment tracking |
| 5 — Inventory, Purchase | Stock with optional serial/batch, procure-to-pay |
| 6 — Helpdesk, Projects, Assets/Contracts | Tickets, installation projects, warranty/AMC |
| 7 — Field Service & apps | Dispatch, tracking, customer/technician/partner apps, settlements |
| 8 — Extend | Documents, marketing, portals, integrations; **recruitment** and AI later |

---

## 14. Conclusion

The documents together already define most of the *functional content* for a strong CRM and a solar/CCTV ERP. What they do not provide is the platform that makes it **modular, configurable and multi-business**. The decisive gaps are: (1) no module manager and dependency rules, (2) no customisation layer for pipelines/fields/workflows, (3) CRM taxonomies and single-pipeline design, (4) missing HR/payroll and generic income/expense, (5) hard-wired India/solar assumptions and a late tenancy model, and (6) unresolved business rules and internal inconsistencies. Closing these before implementation turns the two documents from a solar-company specification into a blueprint for a reusable ERP & CRM platform.

> **Notes on method.** The PDF text was extracted programmatically; a few table cells (the dispatch-weight table in Doc A §10.3, the event table in §14 and the entity table in §15) extracted with broken alignment, so item R8 flags that table as needing confirmation against the original rather than as a confirmed error. Everything in Doc B beyond what its §15 marks as "observed" is described by Doc B itself as inferred from settings text and release notes.
