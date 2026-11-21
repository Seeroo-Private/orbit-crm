// Template: IP/PoE CCTV installation for a residential villa (India). Scales per camera.
// Rates are INDICATIVE (₹, pre-GST) — replace with your supplier quotes and local labour rates.
import { applySize, autoSchedule, estimate } from './pmCalc.js';

const DEFAULT_CAMS = 8;
const RATE = { 'Security Consultant': 1500, 'Network Engineer': 1600, 'CCTV Technician': 800, Electrician: 900, Helper: 500, Supervisor: 1200, 'Documentation Executive': 900 };
let n = 0;
const lab = (role, fixed = 0, perKw = 0) => ({ role, fixed, perKw, rate: RATE[role] });
const mat = (item, unit, fixed, perKw, rate) => ({ item, unit, fixed, perKw, rate });
function X(name, o = {}, kids = []) {
  return { id: `c${++n}`, key: o.key || null, name, off: 0, dur: o.dur || 0, kind: o.kind || 'node', res: (o.labor || [])[0]?.role || o.res || '', dep: o.dep || [], kids, mat: o.mat || [], labor: o.labor || [], crew: o.crew || 0, note: o.note || '', par: !!o.par };
}
const M = (name, o = {}) => X(name, { ...o, kind: 'milestone' });
const D = (name, o = {}) => X(name, { dur: 1, ...o, kind: 'deliverable' });
function seq(list) { list.forEach((k, i) => { if (i && !k.dep.length && !k.par) k.dep = [list[i - 1].id]; }); return list; }
const P = (name, kids, o) => X(name, o, seq(kids));
const SC = 'Security Consultant', NE = 'Network Engineer', TECH = 'CCTV Technician', HELP = 'Helper', ELEC = 'Electrician', SUP = 'Supervisor', DOC = 'Documentation Executive';

const tree = seq([
  P('Assessment & Design', [
    P('Requirements & Risk Assessment', [
      X('Walkthrough & risk assessment', { labor: [lab(SC, 0.5)], crew: 1, note: 'Identify entry points and blind spots: main gate, driveway, entry doors, perimeter wall, garage, staircase, terrace, side passages. Agree privacy exclusion zones — do not cover bedrooms, bathrooms or neighbouring property.' }),
      X('Retention, remote access & alerting requirements', { labor: [lab(SC, 0.25)], crew: 1, note: 'Retention days (typically 15–30), who gets mobile access, motion/line-crossing alerts, audio recording (check local privacy rules), internet upload speed for remote view.' }),
      M('Requirements signed off'),
    ]),
    P('Site Survey', [
      X('Perimeter & building survey', { labor: [lab(SC, 0.5, 0.05), lab(HELP, 0.5)], crew: 2, note: 'Mounting height ~2.5–3 m, field of view and distance, lighting / IR range, glare and backlight, vandal-reach, tree/obstruction check; mark every camera point on the plan.' }),
      X('Cable route & civil survey', { labor: [lab(TECH, 0.5, 0.02)], crew: 1, note: 'Concealed vs surface conduit, wall chasing / core drilling, ceiling access, outdoor cable protection, distance from NVR to each camera (Cat6 PoE limit 100 m).' }),
      X('Network & power survey', { labor: [lab(NE, 0.5)], crew: 1, note: 'Rack/NVR location (ventilated, lockable, away from the entrance), mains point and earthing, router location, internet link, UPS placement.' }),
      D('Survey report & camera-location plan', { labor: [lab(SC, 0.25)], crew: 1 }),
    ]),
    P('System Design', [
      X('Camera selection & placement plan', { labor: [lab(SC, 0.5, 0.05)], crew: 1, note: '4 MP (or higher) PoE IP cameras, H.265, IP66+ outdoors, WDR for gate/entrance backlight, IR 30 m, lens by distance (2.8 mm wide / 4 mm / varifocal).' }),
      X('Storage, bandwidth & PoE budget calculation', { labor: [lab(NE, 0.5, 0.02)], crew: 1, note: 'GB per day per camera ≈ bitrate (Mbps) × 10.8. 4 MP H.265 ≈ 2 Mbps → ~650 GB per camera per 30 days; divide by 0.9 for fill headroom. Sum camera PoE watts + 20% against NVR/switch PoE budget. Verify live bitrate after install.' }),
      X('Network & power design', { labor: [lab(NE, 0.5)], crew: 1, note: 'Isolated camera VLAN/NVR PoE network, no direct internet exposure (VPN / vendor cloud only), UPS sized for NVR + PoE load for ≥ 30–60 min.' }),
      X('BOM, costing & quotation', { labor: [lab(SC, 0.5)], crew: 1 }),
      D('Design pack & quotation', { labor: [lab(SC, 0.25)], crew: 1 }),
      M('Design approved & advance received'),
    ]),
  ]),
  P('Procurement & Pre-configuration', [
    P('Ordering', [
      X('Purchase orders', { key: 'po', labor: [lab(SC, 0.25)], crew: 1 }),
      X('Supplier lead time (cameras, NVR, HDD, UPS)', { dur: 3, par: true, dep: ['po'], note: 'Typical stock availability; extend for specific brands or special lenses.' }),
    ]),
    P('Receiving & Bench Test', [
      X('Material delivery to site', { labor: [lab(HELP, 0.5)], crew: 1, mat: [mat('Transport & handling', 'lot', 1, 0, 1500)] }),
      X('Incoming check', { labor: [lab(TECH, 0.25, 0.02)], crew: 1, note: 'Count cameras/accessories, record serial numbers & warranty cards, HDD seals intact, genuine surveillance-grade HDD.' }),
      X('Bench pre-configuration & firmware update', { labor: [lab(NE, 0.25, 0.05)], crew: 1, note: 'Update firmware, change default passwords, set static IPs, NTP time, format HDD, add cameras to NVR and confirm recording before going on site.' }),
    ]),
  ]),
  P('Installation', [
    P('Cabling & Containment', [
      X('Access equipment & safety setup', { labor: [lab(SUP, 0.25), lab(HELP, 0.25)], crew: 2, mat: [mat('Ladder / scaffold hire', 'lot', 1, 0, 1500)], note: 'Work-at-height precautions; isolate mains before any electrical work.' }),
      X('Conduit, casing & wall chasing', { labor: [lab(TECH, 0.25, 0.12), lab(HELP, 0.25, 0.12)], crew: 2, mat: [mat('PVC conduit, casing, bends & saddles', 'm', 0, 15, 18)], note: 'Seal wall penetrations against water and insects; keep low-voltage cable separate from mains by ≥ 30 cm.' }),
      X('Cat6 cable pulling (cameras to rack)', { labor: [lab(TECH, 0.25, 0.1), lab(HELP, 0.25, 0.1)], crew: 2, mat: [mat('Cat6 outdoor-rated UTP cable (UV, 100 m max run)', 'm', 20, 35, 26)] }),
      X('Cable testing & labelling', { labor: [lab(TECH, 0.25, 0.02)], crew: 1, mat: [mat('Cable labels & ties', 'lot', 1, 0, 500)] }),
    ]),
    P('Camera Installation', [
      X('Camera mounting & weatherproofing', { labor: [lab(TECH, 0.25, 0.15), lab(HELP, 0.25, 0.1)], crew: 2, mat: [mat('4 MP IP PoE camera, H.265, IP66 bullet/dome mix', 'nos', 0, 1, 4800), mat('Junction box / bracket', 'nos', 0, 1, 180), mat('Anchors & screws', 'sets', 0, 1, 120)], note: 'Drip loops on every outdoor cable, silicone seal at the junction box, camera out of easy reach.' }),
      X('Termination & PoE surge protection', { labor: [lab(TECH, 0.25, 0.05)], crew: 1, mat: [mat('RJ45 connectors & boots', 'nos', 0, 4, 25), mat('PoE surge protector (outdoor runs)', 'nos', 0, 0.5, 450)] }),
      X('Aiming, focus & field-of-view adjustment', { labor: [lab(TECH, 0.25, 0.05), lab(HELP, 0.25)], crew: 2, note: 'Aim with the live view on a phone/laptop; check plate/face capture distances at gate and doors.' }),
    ]),
    P('Rack, Power & Recording', [
      X('Network rack / wall cabinet mounting', { labor: [lab(TECH, 0.25), lab(HELP, 0.25)], crew: 2, mat: [mat('6U wall-mount rack with patch panel', 'nos', 1, 0, 3800)] }),
      X('NVR, HDD & UPS installation', { labor: [lab(TECH, 0.25), lab(ELEC, 0.25)], crew: 2, mat: [mat('NVR base unit (PoE-capable, H.265)', 'nos', 1, 0, 2500), mat('NVR per-channel capacity (8/16-ch PoE NVR, apportioned)', 'nos', 0, 1, 900), mat('Surveillance-grade HDD (~0.6 TB per camera ≈ 20–30 days)', 'TB', 0, 0.6, 2200), mat('UPS ≥ 1 kVA (NVR + PoE load)', 'nos', 1, 0, 5500), mat('Dedicated power point, MCB & earthing', 'lot', 1, 0, 1200), mat('HDMI cable, patch cords & consumables', 'lot', 1, 0, 800)] }),
    ]),
    M('Physical installation complete'),
  ]),
  P('Configuration & Commissioning', [
    P('System Configuration', [
      X('NVR network, time & recording schedule', { labor: [lab(NE, 0.25, 0.03)], crew: 1, note: 'Static IP, NTP, continuous + event recording, overwrite on, disk-health alerts.' }),
      X('Camera settings: codec, bitrate, WDR, IR, privacy masks', { labor: [lab(NE, 0.5, 0.05)], crew: 1, note: 'H.265, fixed bitrate cap per storage plan, privacy masks for neighbours/windows, motion zones to reduce false alerts.' }),
      X('User accounts, passwords & hardening', { labor: [lab(NE, 0.25)], crew: 1, note: 'Unique strong admin password, separate viewer accounts, disable UPnP and default ports, latest firmware, no direct internet exposure.' }),
      X('Remote access & mobile app set-up', { labor: [lab(NE, 0.25)], crew: 1 }),
    ]),
    P('Testing & Acceptance', [
      X('Day & night image-quality and coverage test', { dur: 1, labor: [lab(TECH, 0.25, 0.03), lab(NE, 0.25)], note: 'Verify at dusk/night: IR reach, glare from lights, licence-plate/face distances, no dead zones.' }),
      X('Recording, playback & retention verification', { labor: [lab(NE, 0.25)], crew: 1 }),
      X('Failure tests: power cut & network loss', { labor: [lab(ELEC, 0.25), lab(NE, 0.25)], crew: 2, note: 'Confirm UPS carries the NVR/PoE load, cameras keep recording locally, alerts/remote access recover automatically.' }),
      D('Commissioning report & camera-location diagram', { labor: [lab(DOC, 0.5)], crew: 1 }),
      M('Customer acceptance'),
    ]),
  ]),
  P('Handover & Support', [
    P('Handover', [
      X('Customer training: live view, playback, export, alerts', { labor: [lab(NE, 0.5)], crew: 1 }),
      D('Handover pack: sealed credentials, warranties, as-built diagram', { labor: [lab(DOC, 0.5)], crew: 1, mat: [mat('"CCTV in operation" signage', 'nos', 1, 0, 300)], note: 'Hand over admin credentials securely (sealed/one-time), warranty cards and serials, retention settings, and privacy/signage guidance.' }),
      X('Final invoice & payment closure', { labor: [lab(SC, 0.25)], crew: 1 }),
      M('Project closed', { key: 'closed' }),
    ]),
    P('Post-handover Care', [
      X('30-day review: bitrate vs storage, false alerts', { labor: [lab(NE, 0.25)], crew: 1, note: 'Check actual bitrate and recorded days per channel against the storage plan; tune motion zones.' }),
      X('Annual preventive maintenance (AMC)', { labor: [lab(TECH, 0.25, 0.03)], crew: 1, note: 'Lens cleaning, firmware updates, HDD SMART health, UPS battery test, cable/junction-box inspection.' }),
    ], { dep: ['closed'] }),
  ]),
]);

const keys = {};
(function w(a) { a.forEach((x) => { if (x.key) keys[x.key] = x.id; w(x.kids); }); })(tree);
(function w(a) { a.forEach((x) => { x.dep = x.dep.map((d) => keys[d] || d); delete x.par; w(x.kids); }); })(tree);
applySize(tree, DEFAULT_CAMS);
autoSchedule(tree);

export const CCTV_PARAMS = {
  size: DEFAULT_CAMS, unit: 'cameras', overhead: 8, gstGoods: 18, gstServices: 18, autoSchedule: true,
  assumptions: [
    'All rates are indicative (₹, pre-GST) for an 8-camera 4 MP IP/PoE villa system — replace with your supplier quotes. Listings show ₹60–95k for a basic 8-camera setup; this template prices a fully documented spec (conduit-protected Cat6, rack, UPS, hardening, testing, training), so it will land higher.',
    'GST is assumed at 18% on cameras, NVR, storage and services — confirm the rates applicable to each item with your tax advisor.',
    'Storage: ~0.6 TB per camera ≈ 20–30 days at ~2 Mbps H.265 (GB/day ≈ Mbps × 10.8, plus ~10% headroom). Re-size the HDD if you raise bitrate, resolution or retention, and check the live bitrate after install.',
    'NVR cost is apportioned per channel; for more than 8 cameras budget a 16-channel NVR or a separate PoE switch and check the total PoE power budget (sum of camera watts + 20%).',
    'Respect privacy: do not cover neighbours, bedrooms or bathrooms; follow local rules on audio recording and display signage.',
  ],
};

export const CCTV_TEMPLATE = {
  name: 'Residential Villa CCTV Installation (IP/PoE)',
  category: 'Security',
  description: 'Survey, design, procurement, cabling, camera install, NVR/storage/UPS, hardening, acceptance testing and handover for an IP/PoE CCTV system — BOM, storage and man-day plan scale with the number of cameras.',
  levels: ['Phase', 'Work Package', 'Activity', 'Task'],
  priority: 'Medium',
  resources: [{ role: 'Security Consultant', qty: 1 }, { role: 'Network Engineer', qty: 1 }, { role: 'CCTV Technician', qty: 2 }, { role: 'Electrician', qty: 1 }, { role: 'Helper', qty: 2 }, { role: 'Supervisor', qty: 1 }, { role: 'Documentation Executive', qty: 1 }],
  params: CCTV_PARAMS,
  nodes: tree,
  budget: Math.round(estimate(tree, DEFAULT_CAMS, CCTV_PARAMS).total / 1000) * 1000,
};
