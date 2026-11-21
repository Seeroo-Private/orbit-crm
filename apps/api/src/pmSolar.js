// Template: grid-tied residential rooftop solar PV (India). Sized per kWp; quantities, man-days and durations scale with size.
// Rates are INDICATIVE (₹, pre-GST) — replace with your supplier quotes / local labour rates.
import { applySize, autoSchedule, estimate } from './pmCalc.js';

const DEFAULT_KW = 3;
const RATE = { 'Solar Consultant': 1200, 'Site Engineer': 1800, 'Design Engineer': 2000, 'Documentation Executive': 900, Electrician: 900, 'Solar Technician': 800, Fabricator: 900, Helper: 550, Supervisor: 1300, 'Logistics Crew': 700 };
let n = 0;
const lab = (role, fixed = 0, perKw = 0) => ({ role, fixed, perKw, rate: RATE[role] });
const mat = (item, unit, fixed, perKw, rate) => ({ item, unit, fixed, perKw, rate });
// X(name, opts, kids): kind node|milestone|deliverable; crew = people working simultaneously (duration derived from man-days)
function X(name, o = {}, kids = []) {
  return { id: `s${++n}`, key: o.key || null, name, off: 0, dur: o.dur || 0, kind: o.kind || 'node', res: (o.labor || [])[0]?.role || o.res || '', dep: o.dep || [], kids, mat: o.mat || [], labor: o.labor || [], crew: o.crew || 0, note: o.note || '', par: !!o.par };
}
const M = (name, o = {}) => X(name, { ...o, kind: 'milestone' });
const D = (name, o = {}) => X(name, { dur: 1, ...o, kind: 'deliverable' });
// sequential by default: each child waits for the previous sibling unless it has explicit deps or is marked par
function seq(list) { list.forEach((k, i) => { if (i && !k.dep.length && !k.par) k.dep = [list[i - 1].id]; }); return list; }
const P = (name, kids, o) => X(name, o, seq(kids));

const tree = seq([
  P('Pre-sales & Site Assessment', [
    P('Customer Onboarding & Feasibility', [
      X('Consumption & tariff analysis', { labor: [lab('Solar Consultant', 0.5)], crew: 1, note: 'Collect last 12 electricity bills; note sanctioned load, tariff slab and phase (1φ/3φ). Rule of thumb: 1 kWp yields ~4–5 units/day (≈120–150 kWh/month).' }),
      X('Eligibility check & document collection', { labor: [lab('Documentation Executive', 0.5)], crew: 1, note: 'Aadhaar, latest electricity bill (consumer no.), bank passbook/cancelled cheque, mobile + email, roof-ownership proof or owner NOC (tenant/society), sanctioned-load details.' }),
      X('Proposal & customer sign-off', { labor: [lab('Solar Consultant', 0.5)], crew: 1 }),
      M('Customer approval & advance received'),
    ]),
    P('Technical Site Survey', [
      X('Roof survey', { labor: [lab('Site Engineer', 0.5, 0.05), lab('Helper', 0.5, 0.05)], crew: 2, note: 'Usable area (≈8–10 m² per kWp), orientation (south-facing preferred), roof type (RCC / metal sheet / tile), parapet height, obstructions, water tanks, access route for material lifting.' }),
      X('Shadow analysis', { labor: [lab('Design Engineer', 0.5, 0.1)], crew: 1, note: 'Sun-path / shade study (SolarPathfinder, PVsyst or app). Target < 5% annual shading loss; keep arrays clear of tanks, stair-heads and neighbouring buildings.' }),
      X('Structural & roof-condition assessment', { labor: [lab('Site Engineer', 0.5, 0.05)], crew: 1, note: 'Load-bearing capacity, waterproofing condition, parapet. Decide anchoring vs non-penetrating ballast; wind load per IS 875 (Part 3) for the site.' }),
      X('Electrical survey', { labor: [lab('Electrician', 0.5)], crew: 1, note: 'Main panel & busbar capacity, sanctioned load, phase, existing earthing, meter location, inverter location (shaded, ventilated, short cable run) and cable routes.' }),
      D('Site survey report', { labor: [lab('Design Engineer', 0.25)], crew: 1 }),
    ]),
    P('System Design & Engineering', [
      X('System sizing & module count', { labor: [lab('Design Engineer', 0.5, 0.05)], crew: 1, note: 'Size to consumption and sanctioned load. DC:AC ratio 1.0–1.3. Module count = ceil(kWp × 1000 / module Wp).' }),
      X('Array layout & string design', { labor: [lab('Design Engineer', 0.5, 0.1)], crew: 1, note: 'String Voc at lowest site temperature must stay below inverter max DC voltage; Vmp range inside MPPT window.' }),
      X('SLD, earthing & lightning-protection design', { labor: [lab('Design Engineer', 0.5)], crew: 1, note: 'Single-line diagram with DC/AC protection (fuse, SPD, isolator, MCB/RCCB), 3 earth pits (DC/structure, AC/equipment, lightning), lightning arrester and down-conductor path.' }),
      X('Mounting-structure design', { labor: [lab('Design Engineer', 0.5, 0.05)], crew: 1, note: 'Hot-dip galvanised steel (thickness per MNRE/DISCOM spec, typically ≥ 80 µm), tilt ≈ site latitude, wind-load check, ≥ 300 mm clearance for cleaning and ventilation.' }),
      X('BOM, costing & quotation', { labor: [lab('Solar Consultant', 0.5)], crew: 1 }),
      D('Design pack & quotation', { labor: [lab('Design Engineer', 0.25)], crew: 1 }),
      M('Design approved by customer'),
    ]),
  ]),
  P('Approvals & Subsidy Registration', [
    P('National Portal & DISCOM', [
      X('Registration on PM Surya Ghar portal', { labor: [lab('Documentation Executive', 0.25)], crew: 1, note: 'State, DISCOM, consumer number, mobile & email. Mobile number must be linked to the electricity connection.' }),
      X('Apply for rooftop solar & select registered vendor', { labor: [lab('Documentation Executive', 0.25)], crew: 1, note: 'Vendor must be registered on the national portal for the customer\'s DISCOM; price is agreed directly with the vendor.' }),
      X('DISCOM technical feasibility approval', { dur: 7, labor: [lab('Documentation Executive', 0.25)], note: 'Waiting period — turnaround varies by DISCOM/state (may be deemed for small systems). Follow up on the portal.' }),
      X('Net-metering application & fees', { labor: [lab('Documentation Executive', 0.5)], crew: 1, mat: [mat('DISCOM application, inspection & meter-testing fees (indicative)', 'lot', 1, 0, 2500)] }),
      M('Feasibility approval received'),
    ]),
    P('Compliance', [
      X('DCR / ALMM compliance check', { labor: [lab('Documentation Executive', 0.25)], crew: 1, note: 'Modules must be ALMM-listed and domestic-content (DCR) for the central subsidy; vendor generates the B2C DCR certificate and enters its number on the portal. Keep serial numbers.' }),
      X('Society / landlord NOC (if applicable)', { labor: [lab('Documentation Executive', 0.25)], crew: 1 }),
    ]),
  ]),
  P('Procurement & Logistics', [
    P('Ordering & Fabrication', [
      X('Purchase orders', { key: 'po', labor: [lab('Solar Consultant', 0.5)], crew: 1 }),
      X('Supplier lead time (modules, inverter, BoS)', { dur: 5, par: true, dep: ['po'], note: 'Typical stock lead time; extend for specific brands/DCR availability.' }),
      X('Structure fabrication & galvanising', { par: true, dep: ['po'], labor: [lab('Fabricator', 0.5, 0.3), lab('Helper', 0.5, 0.3)], crew: 2 }),
    ]),
    P('Receiving & QC', [
      X('Material delivery to site', { labor: [lab('Logistics Crew', 1, 0.1)], crew: 2, mat: [mat('Transport, loading & roof lifting', 'lot', 1, 0, 3000)] }),
      X('Incoming quality check', { labor: [lab('Site Engineer', 0.25, 0.05)], crew: 1, note: 'Verify module serial numbers & flash reports, inverter model/BIS-IEC certificates, GI thickness, cable spec; photograph serial numbers for the portal.' }),
      D('Delivery challan & serial-number register', { labor: [lab('Documentation Executive', 0.25)], crew: 1 }),
    ]),
  ]),
  P('Installation', [
    P('Civil & Structure', [
      X('Roof access, safety setup & marking', { key: 'mark', labor: [lab('Supervisor', 0.25), lab('Solar Technician', 0.25, 0.05), lab('Helper', 0.75, 0.05)], crew: 3, mat: [mat('Scaffolding / fall-protection hire', 'lot', 1, 0, 2500)], note: 'Harness, edge protection, ladder tie-off; no work in wet or high-wind conditions. Mark structure footprints per the layout drawing.' }),
      X('Anchoring / foundation', { labor: [lab('Solar Technician', 0.25, 0.15), lab('Helper', 0.5, 0.15)], crew: 2, mat: [mat('Anchor bolts / base-plate hardware', 'nos', 0, 10, 100), mat('Roof sealing / waterproofing compound', 'lot', 1, 0, 1200)] }),
      X('Structure erection & alignment', { key: 'struct', labor: [lab('Solar Technician', 0.25, 0.2), lab('Helper', 0.25, 0.2)], crew: 2, mat: [mat('Hot-dip GI mounting structure (incl. clamps)', 'kWp', 0, 1, 4800)] }),
    ]),
    P('Earthing & Lightning Protection', [
      X('Earthing — 3 pits (DC/structure, AC/equipment, lightning)', { labor: [lab('Solar Technician', 0.5), lab('Helper', 0.75)], crew: 2, mat: [mat('Earth pit (electrode, chamber, backfill)', 'nos', 3, 0, 1800), mat('Earthing strip / wire', 'm', 25, 0, 90)], note: 'Typically ≤ 5 Ω per pit/system — confirm against DISCOM spec; bond structure, inverter body and DBs.' }),
      X('Lightning arrester & down-conductor', { par: true, labor: [lab('Electrician', 0.25), lab('Helper', 0.25)], crew: 2, mat: [mat('Lightning arrester kit (rod + down-conductor)', 'nos', 1, 0, 4500)] }),
    ], { key: 'earth', par: true, dep: ['mark'] }),
    P('Module Installation', [
      X('Module lifting & mounting', { labor: [lab('Solar Technician', 0.25, 0.15), lab('Helper', 0.25, 0.15)], crew: 2, mat: [mat('DCR mono PERC/TOPCon module, 540 Wp', 'nos', 0, 1000 / 540, 12000)], note: 'Handle by frame, no standing/kneeling on modules; torque clamps per manufacturer.' }),
      X('String wiring & MC4 termination', { key: 'str', labor: [lab('Electrician', 0.25, 0.1)], crew: 1, mat: [mat('MC4 connector pairs', 'pairs', 2, 1, 120)] }),
    ], { dep: ['struct'] }),
    P('Electrical Works', [
      X('Inverter, DCDB & ACDB mounting', { key: 'inv', labor: [lab('Electrician', 0.25, 0.05), lab('Helper', 0.25)], crew: 2, mat: [mat('Grid-tie string inverter (≥ 5-yr warranty)', 'kW', 0, 1, 8500), mat('DC distribution box (DC SPD, isolator/fuses)', 'nos', 1, 0, 3200), mat('AC distribution box (MCB/RCCB, AC SPD)', 'nos', 1, 0, 2800), mat('Wi-Fi monitoring dongle', 'nos', 1, 0, 1200)] }),
      X('DC cabling & conduit', { key: 'dc', dep: ['str'], labor: [lab('Electrician', 0.25, 0.15), lab('Helper', 0.25, 0.1)], crew: 2, mat: [mat('Solar PV cable 4 mm² (UV-resistant, tinned copper)', 'm', 10, 8, 55)] }),
      X('AC cabling & termination to main panel', { key: 'ac', dep: ['inv'], labor: [lab('Electrician', 0.5, 0.1), lab('Helper', 0.25)], crew: 2, mat: [mat('AC cable 3-core 4 mm² copper (FRLS)', 'm', 20, 0, 140)] }),
      X('Labelling, cable dressing & signage', { key: 'label', dep: ['ac', 'dc'], labor: [lab('Electrician', 0.25)], crew: 1, mat: [mat('Conduits, trays, ties, lugs, glands, labels & signage', 'lot', 1, 0, 2500)] }),
    ], { dep: ['struct'] }),
    M('Mechanical & electrical completion', { dep: ['label', 'earth'] }),
  ]),
  P('Testing, Commissioning & Net Metering', [
    P('Pre-commissioning Tests', [
      X('Visual & mechanical inspection', { labor: [lab('Site Engineer', 0.25)], crew: 1 }),
      X('String Voc/Isc, polarity & insulation-resistance tests', { labor: [lab('Site Engineer', 0.25, 0.05), lab('Electrician', 0.25, 0.05)], crew: 2, note: 'Record all readings in the commissioning report (megger IR test per manufacturer/DISCOM spec).' }),
      X('Earth-resistance test', { labor: [lab('Electrician', 0.25)], crew: 1 }),
    ]),
    P('Commissioning', [
      X('Inverter commissioning, anti-islanding & grid synchronisation', { labor: [lab('Site Engineer', 0.5), lab('Electrician', 0.25)], crew: 2, note: 'Anti-islanding and grid-code settings per CEA connectivity regulations and DISCOM requirement.' }),
      X('Monitoring app set-up & first-generation check', { labor: [lab('Site Engineer', 0.25)], crew: 1 }),
    ]),
    P('Net Meter & DISCOM Inspection', [
      X('Upload commissioning report with geo-tagged photos', { labor: [lab('Documentation Executive', 0.5)], crew: 1, note: 'Geo-tagged photos of array, inverter, earthing, lightning arrester and serial numbers; DCR certificate number; SLD.' }),
      X('DISCOM joint inspection', { dur: 5, labor: [lab('Site Engineer', 0.5)], note: 'Inspector checks structure, earthing drawing, layout, SLD, wiring neatness and AC/DC protection incl. SPD. Waiting time varies by DISCOM.' }),
      X('Bi-directional net meter installation, test & seal', { dur: 7, mat: [mat('Bi-directional net meter (if consumer-supplied)', 'nos', 1, 0, 4500)], note: 'DISCOM installs and seals the meter; the online commissioning certificate is generated afterwards.' }),
      M('Commissioning certificate issued', { key: 'cc' }),
    ]),
  ]),
  P('Subsidy & Handover', [
    P('Subsidy Claim', [
      X('Submit bank details / cancelled cheque on portal', { labor: [lab('Documentation Executive', 0.25)], crew: 1 }),
      X('Central subsidy (CFA) release', { dur: 30, note: 'Typically credited to the customer\'s bank ~30 days after commissioning — varies; follow up on portal if delayed.' }),
      M('Subsidy credited to customer', { key: 'sub' }),
    ]),
    P('Customer Handover', [
      X('Customer training: monitoring, cleaning & safety', { labor: [lab('Site Engineer', 0.5)], crew: 1 }),
      D('O&M manual, warranty cards & as-built SLD', { labor: [lab('Documentation Executive', 0.5)], crew: 1, note: 'Modules: product ~12 yr / performance ~25 yr; inverter typically 5–10 yr — hand over certificates and serial numbers.' }),
      X('Final invoice & payment closure', { labor: [lab('Solar Consultant', 0.25)], crew: 1 }),
    ], { par: true }),
    P('Post-handover Care', [
      X('30-day generation review', { labor: [lab('Site Engineer', 0.25)], crew: 1 }),
      X('Annual cleaning & inspection plan (AMC)', { labor: [lab('Solar Technician', 0.25, 0.05)], crew: 1 }),
    ], { dep: ['sub'] }),
    M('Project closed'),
  ]),
]);

// last milestone waits for the parallel handover / subsidy branches
const last = tree[tree.length - 1].kids;
last[last.length - 1].dep = [last[0].id, last[1].id, last[2].id];

// resolve keys -> ids, drop helper field
const keys = {};
(function w(a) { a.forEach((x) => { if (x.key) keys[x.key] = x.id; w(x.kids); }); })(tree);
(function w(a) { a.forEach((x) => { x.dep = x.dep.map((d) => keys[d] || d); delete x.par; w(x.kids); }); })(tree);

applySize(tree, DEFAULT_KW);
autoSchedule(tree);

export const SOLAR_PARAMS = {
  size: DEFAULT_KW, unit: 'kWp', overhead: 8, gstGoods: 5, gstServices: 18, autoSchedule: true,
  subsidy: { label: 'PM Surya Ghar central subsidy (est.)', tiers: [[2, 30000], [1, 18000]] },
  assumptions: [
    'All rates are indicative (₹, pre-GST) for a 3 kWp grid-tied system — replace with your supplier quotes and local labour rates.',
    'GST on solar equipment was cut from 12% to 5% effective 22 Sep 2025. The installation/service GST rate (18% assumed here) must be confirmed with your tax advisor.',
    'Central subsidy: ₹30,000/kW for the first 2 kW + ₹18,000 for the 3rd kW (max ₹78,000); requires registered vendor, ALMM + DCR modules and a commissioning certificate. State top-ups and housing-society (RWA) rules differ — verify on the national portal.',
    'Labour is budgeted conservatively (~2.5–3.5 man-days/kW on site incl. fabrication, anchoring, earthing and lightning protection). NREL time-and-motion studies of US roof PV measured 3.5–6.9 worker-hours/kW for module/racking work alone.',
    'DISCOM feasibility, inspection, net-meter and subsidy-release durations vary by state; adjust the waiting-period tasks after your first few jobs.',
  ],
};

export const SOLAR_TEMPLATE = {
  name: 'Residential Rooftop Solar PV (Grid-tied)',
  category: 'Solar',
  description: 'End-to-end residential rooftop solar: survey, design, PM Surya Ghar / DISCOM approvals, procurement, installation, net metering, subsidy and handover — with a size-scaled BOM, man-day crew plan and cost estimate.',
  levels: ['Phase', 'Work Package', 'Activity', 'Task'],
  priority: 'Medium',
  resources: [{ role: 'Solar Consultant', qty: 1 }, { role: 'Site Engineer', qty: 1 }, { role: 'Design Engineer', qty: 1 }, { role: 'Documentation Executive', qty: 1 }, { role: 'Electrician', qty: 2 }, { role: 'Solar Technician', qty: 2 }, { role: 'Fabricator', qty: 1 }, { role: 'Helper', qty: 3 }, { role: 'Supervisor', qty: 1 }, { role: 'Logistics Crew', qty: 2 }],
  params: SOLAR_PARAMS,
  nodes: tree,
  budget: Math.round(estimate(tree, DEFAULT_KW, SOLAR_PARAMS).total / 1000) * 1000,
};
