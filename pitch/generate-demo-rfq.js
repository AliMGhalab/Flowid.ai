/**
 * Generate a realistic Malaysian client RFQ document for demoing the
 * unstructured-input feature.
 *
 * Run: node pitch/generate-demo-rfq.js
 * Output: pitch/Demo_RFQ_Palm_Oil_Cooling.pdf
 */

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const W = 210;
const M = 20;

function line(y, w = W - M * 2) {
  doc.setDrawColor(180, 180, 180);
  doc.line(M, y, M + w, y);
}

function p(text, opts = {}) {
  const fontSize = opts.size ?? 10;
  const bold = opts.bold ?? false;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(opts.color ? opts.color[0] : 40, opts.color ? opts.color[1] : 40, opts.color ? opts.color[2] : 40);
  const lines = doc.splitTextToSize(text, opts.w ?? W - M * 2);
  doc.text(lines, opts.x ?? M, y);
  return lines.length * fontSize * 0.42;
}

let y = M;

// ─── HEADER / LETTERHEAD ──────────────────────────────────────────────────
doc.setFillColor(30, 64, 175);
doc.rect(0, 0, W, 16, 'F');
doc.setTextColor(255, 255, 255);
doc.setFontSize(14);
doc.setFont('helvetica', 'bold');
doc.text('SAWIT MAJU SDN BHD', M, 10);
doc.setFontSize(8);
doc.setFont('helvetica', 'normal');
doc.text('Palm Oil Plantation & Mill Operations · Pengerang, Johor', M, 14);

y = 24;

// ─── DOCUMENT TITLE ───────────────────────────────────────────────────────
doc.setTextColor(30, 64, 175);
doc.setFontSize(16);
doc.setFont('helvetica', 'bold');
doc.text('REQUEST FOR QUOTATION', M, y);
y += 5;
doc.setFontSize(10);
doc.setFont('helvetica', 'normal');
doc.setTextColor(80, 80, 80);
doc.text('Closed-Loop Cooling Water System — Mill Process Equipment', M, y);
y += 4;
doc.setFontSize(9);
doc.text('Ref: SAWIT-RFQ-2026-014   |   Date: 2 June 2026   |   Closing: 25 June 2026', M, y);
y += 7;

line(y);
y += 6;

// ─── INTRODUCTION ────────────────────────────────────────────────────────
y += p('1. PROJECT BACKGROUND', { bold: true, size: 11, color: [30, 64, 175] });
y += 2;
y += p(
  'Sawit Maju Sdn Bhd is upgrading the cooling water utility system at our palm oil mill in Pengerang, Johor (60 tonnes FFB/hr capacity). The current open-loop cooling tower configuration has reached end-of-life and we are transitioning to a closed-loop chilled water system to serve our sterilisation autoclave heat exchangers, kernel oil refinery condensers, and ancillary process cooling loads.',
  { size: 10 },
);
y += 5;
y += p(
  'This project must be commissioned before our annual major maintenance shutdown in Q4 2026.',
  { size: 10 },
);
y += 8;

// ─── SCOPE ────────────────────────────────────────────────────────────────
y += p('2. SCOPE OF SUPPLY & INSTALLATION', { bold: true, size: 11, color: [30, 64, 175] });
y += 2;
y += p('The contractor shall supply, install, test, and commission a complete cooling water circulation system including:', { size: 10 });
y += 3;

const scope = [
  'Duty + standby centrifugal pumps with VFD control (one duty, one standby, automatic transfer on fault)',
  'Suction header, discharge header, and expansion vessel — closed loop configuration',
  'Full instrumentation: flow transmitter on main line, pressure transmitters on pump suction and discharge, temperature transmitters on supply and return lines, level transmitter on expansion vessel',
  'Pressure safety relief valves (PSV) — DOSH-registered',
  'Control valve for temperature regulation, all isolation, check, drain, and vent valves',
  'Carbon steel piping (epoxy-lined for corrosion resistance in Malaysian tropical climate)',
  'MCC panel with VFD drives, local control panel with HMI, all power and instrument cabling',
  'Equipment skid, pipe supports, and access platforms',
  'Y-strainer (commissioning), flushing services, performance testing',
];

scope.forEach((item) => {
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize('• ' + item, W - M * 2 - 4);
  doc.text(lines, M + 3, y);
  y += lines.length * 4.2;
});
y += 4;

// ─── TECHNICAL REQUIREMENTS ───────────────────────────────────────────────
y += p('3. TECHNICAL REQUIREMENTS', { bold: true, size: 11, color: [30, 64, 175] });
y += 2;

const tech = [
  ['Fluid',                  'Cooling water (closed loop, treated)'],
  ['Design flow rate',       'Approximately 80 m³/hr (size to actual heat load)'],
  ['Operating pressure',     '6 bar(g) typical'],
  ['Operating temperature',  '32°C supply / 42°C return (typical)'],
  ['Duty cycle',             '24 hours/day, 7 days/week, continuous operation'],
  ['Service life',           'Minimum 15 years under tropical climate'],
  ['Redundancy',             'N+1 pump redundancy with automatic switchover'],
];

doc.setFontSize(9.5);
doc.setFont('helvetica', 'normal');
doc.setTextColor(40, 40, 40);
tech.forEach(([label, val]) => {
  doc.setFont('helvetica', 'bold');
  doc.text(label, M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(val, M + 50, y);
  y += 4.5;
});
y += 4;

// ─── COMPLIANCE ──────────────────────────────────────────────────────────
y += p('4. COMPLIANCE & STANDARDS', { bold: true, size: 11, color: [30, 64, 175] });
y += 2;
y += p('All equipment and installation shall conform to:', { size: 10 });
y += 2;

const standards = [
  'DOSH FMA 1967 — pressure vessel registration and rotating equipment certification',
  'BOMBA UBBL — fire safety for electrical enclosures in industrial buildings',
  'SIRIM QAS — electrical equipment certification (VFD, control panels)',
  'DOE Malaysia — environmental compliance (cooling water discharge)',
  'MS 1745 — code of practice for installation of metallic piping systems',
];

standards.forEach((item) => {
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize('• ' + item, W - M * 2 - 4);
  doc.text(lines, M + 3, y);
  y += lines.length * 4.2;
});
y += 4;

// ─── COMMERCIAL ──────────────────────────────────────────────────────────
y += p('5. COMMERCIAL TERMS', { bold: true, size: 11, color: [30, 64, 175] });
y += 2;
y += p('Project budget ceiling: RM 750,000 (Malaysian Ringgit, inclusive of SST). All pricing in MYR. Payment terms: 30% on order, 50% on delivery, 20% on commissioning sign-off.', { size: 10 });
y += 4;
y += p('Preferred suppliers: Malaysian-registered companies (Sdn Bhd) with offices in Johor, Selangor, or Penang for after-sales support proximity to Pengerang.', { size: 10 });
y += 4;
y += p('Lead time requirement: equipment delivery within 10 weeks of purchase order, installation and commissioning within a further 6 weeks.', { size: 10 });
y += 6;

// ─── CONTACT ─────────────────────────────────────────────────────────────
line(y);
y += 6;
doc.setFontSize(9);
doc.setFont('helvetica', 'bold');
doc.text('SUBMIT TO:', M, y);
y += 4;
doc.setFont('helvetica', 'normal');
doc.text('Ir. Encik Razif bin Abdullah   |   Project Engineer, Sawit Maju Sdn Bhd', M, y);
y += 4;
doc.text('Email: razif.abdullah@sawitmaju.com.my   |   Tel: +60 7-823 4561', M, y);
y += 4;
doc.text('Mill Site: PLO 442, Kawasan Perindustrian Pengerang, 81600 Johor', M, y);

// Footer note
doc.setFontSize(7);
doc.setTextColor(150, 150, 150);
doc.setFont('helvetica', 'italic');
doc.text('Document classification: Restricted to qualified bidders.   |   Page 1 of 1', M, 285);
doc.text('Sawit Maju Sdn Bhd · Co. Reg: 200401012345-D', W - M, 285, { align: 'right' });

// ─── SAVE ────────────────────────────────────────────────────────────────
const out = path.join(__dirname, 'Demo_RFQ_Palm_Oil_Cooling.pdf');
doc.save(out);
console.log(`✓ Generated: ${out}`);
console.log(`  Use this PDF to demo the unstructured-input feature.`);
