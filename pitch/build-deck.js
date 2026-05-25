/**
 * Flowid.ai pitch deck generator — AIC Hackathon 2026
 * 10 content slides + title + thank you, per submission criteria.
 *
 * Run: node pitch/build-deck.js
 */

const pptxgen = require('pptxgenjs');

// ─── BRAND PALETTE ─────────────────────────────────────────────────────────
const C = {
  bgDark:   '020817',  // slate-950 — title / thank-you slides
  bg:       '0F172A',  // slate-900 — content slide background
  card:     '1E293B',  // slate-800 — card / panel
  cardAlt:  '111827',  // slightly different card tone
  border:   '334155',  // slate-700
  white:    'FFFFFF',
  textMain: 'E2E8F0',  // slate-200
  text:     'CBD5E1',  // slate-300
  textMute: '94A3B8',  // slate-400
  textDim:  '64748B',  // slate-500
  blue:     '2563EB',  // brand-600
  blueLite: '60A5FA',  // brand-400
  cyan:     '22D3EE',  // cyan-400
  green:    '22C55E',
  amber:    'F59E0B',
  red:      'EF4444',
  violet:   '8B5CF6',
  teal:     '14B8A6',
};

const FONT_H = 'Calibri';        // header
const FONT_B = 'Calibri';        // body

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';     // 13.33" × 7.5"
pres.title = 'Flowid.ai — AIC Hackathon Pitch Deck';
pres.author = 'Ali Ghalab · Amr Ghalab';
pres.company = 'Flowid.ai';

const W = 13.33;
const H = 7.5;
const MARGIN = 0.6;

// ─── Helpers ───────────────────────────────────────────────────────────────
function darkBg(slide) {
  slide.background = { color: C.bg };
}
function darkerBg(slide) {
  slide.background = { color: C.bgDark };
}

// Header on content slide: slide number + title row
function header(slide, num, title, subtitle = '') {
  // small number pill in blue
  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: 0.35, w: 0.55, h: 0.4,
    fill: { color: C.blue }, line: { color: C.blue, width: 0 },
  });
  slide.addText(num, {
    x: MARGIN, y: 0.35, w: 0.55, h: 0.4,
    fontSize: 14, bold: true, color: C.white, fontFace: FONT_H,
    align: 'center', valign: 'middle', margin: 0,
  });
  // title
  slide.addText(title, {
    x: MARGIN + 0.7, y: 0.25, w: W - MARGIN - 0.7 - MARGIN, h: 0.6,
    fontSize: 28, bold: true, color: C.white, fontFace: FONT_H,
    valign: 'middle', margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN + 0.7, y: 0.78, w: W - MARGIN - 0.7 - MARGIN, h: 0.35,
      fontSize: 13, color: C.textMute, fontFace: FONT_B,
      italic: true, valign: 'top', margin: 0,
    });
  }
  // thin underline accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: 1.2, w: 0.6, h: 0.04,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
}

// Footer with source line on data slides
function footer(slide, text) {
  slide.addText(text, {
    x: MARGIN, y: H - 0.45, w: W - MARGIN * 2, h: 0.3,
    fontSize: 9, italic: true, color: C.textDim, fontFace: FONT_B,
    align: 'left', valign: 'middle', margin: 0,
  });
}

// Card with a left accent bar
function card(slide, x, y, w, h, fill = C.card, accent = C.blue) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: fill }, line: { color: C.border, width: 0.5 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.08, h, fill: { color: accent }, line: { color: accent, width: 0 },
  });
}

// Big stat block
function stat(slide, x, y, w, h, value, label, color = C.blueLite) {
  card(slide, x, y, w, h, C.card, color);
  slide.addText(value, {
    x: x + 0.2, y: y + 0.15, w: w - 0.3, h: h * 0.55,
    fontSize: 36, bold: true, color: color, fontFace: FONT_H,
    align: 'left', valign: 'bottom', margin: 0,
  });
  slide.addText(label, {
    x: x + 0.2, y: y + h * 0.6, w: w - 0.3, h: h * 0.35,
    fontSize: 11, color: C.textMute, fontFace: FONT_B,
    align: 'left', valign: 'top', margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 0 — TITLE (excluded from 10-slide count per criteria)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkerBg(s);

  // big brand mark
  s.addText('Flowid.ai', {
    x: MARGIN, y: 2.4, w: W - MARGIN * 2, h: 1.2,
    fontSize: 88, bold: true, color: C.white, fontFace: FONT_H,
    align: 'left', valign: 'middle', margin: 0,
  });

  // gradient accent line
  s.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: 3.65, w: 1.4, h: 0.08,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });

  // tagline
  s.addText('Feasibility Engineering Documentation,', {
    x: MARGIN, y: 3.85, w: W - MARGIN * 2, h: 0.55,
    fontSize: 28, color: C.text, fontFace: FONT_H,
    align: 'left', valign: 'top', margin: 0,
  });
  s.addText('in 4 Minutes — Not 4 Weeks.', {
    x: MARGIN, y: 4.35, w: W - MARGIN * 2, h: 0.6,
    fontSize: 32, bold: true, color: C.blueLite, fontFace: FONT_H,
    align: 'left', valign: 'top', margin: 0,
  });

  // subtitle
  s.addText('AI-powered fluid system engineering for Malaysian industry.', {
    x: MARGIN, y: 5.15, w: W - MARGIN * 2, h: 0.4,
    fontSize: 16, italic: true, color: C.textMute, fontFace: FONT_B,
    align: 'left', valign: 'top', margin: 0,
  });

  // bottom row: event + team
  s.addShape(pres.shapes.LINE, {
    x: MARGIN, y: 6.5, w: W - MARGIN * 2, h: 0,
    line: { color: C.border, width: 1 },
  });
  s.addText('AIC HACKATHON 2026', {
    x: MARGIN, y: 6.65, w: 4, h: 0.4,
    fontSize: 12, bold: true, color: C.cyan, fontFace: FONT_H,
    align: 'left', valign: 'middle', charSpacing: 4, margin: 0,
  });
  s.addText('Ali Ghalab · Amr Ghalab    flowid-ai.vercel.app', {
    x: 4.8, y: 6.65, w: W - 4.8 - MARGIN, h: 0.4,
    fontSize: 12, color: C.textMute, fontFace: FONT_B,
    align: 'right', valign: 'middle', margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — PROBLEM
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '01', 'The Problem',
    'Malaysia\'s engineer pool is growing — but the certification bottleneck holds projects back.');

  // 3 big stat cards
  stat(s, MARGIN,        1.55, 4.0, 1.5, '205,500', 'Registered engineers in Malaysia (BEM, Jan 2024)', C.blueLite);
  stat(s, MARGIN + 4.2,  1.55, 4.0, 1.5, '8%',      'Are Professional Engineers (PE) — only 16,400 can stamp designs', C.amber);
  stat(s, MARGIN + 8.4,  1.55, 4.0, 1.5, '2–6 wks', 'Typical turnaround for fluid system feasibility documentation', C.red);

  // body — left column
  card(s, MARGIN, 3.35, 6.0, 3.4, C.card, C.cyan);
  s.addText('Where the Time Goes', {
    x: MARGIN + 0.3, y: 3.5, w: 5.5, h: 0.4,
    fontSize: 16, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText([
    { text: '60–80% of an engineer\'s time goes to documentation:', options: { color: C.text, fontSize: 12, breakLine: true, paraSpaceAfter: 6 } },
    { text: 'Bill of Materials drafting', options: { color: C.textMute, fontSize: 12, bullet: true, breakLine: true } },
    { text: 'Cost estimation in MYR', options: { color: C.textMute, fontSize: 12, bullet: true, breakLine: true } },
    { text: 'HAZOP risk register', options: { color: C.textMute, fontSize: 12, bullet: true, breakLine: true } },
    { text: 'DOSH / BOMBA / SIRIM compliance citation', options: { color: C.textMute, fontSize: 12, bullet: true, breakLine: true } },
    { text: 'P&ID diagram drafting', options: { color: C.textMute, fontSize: 12, bullet: true, breakLine: true } },
    { text: 'Vendor RFQ preparation', options: { color: C.textMute, fontSize: 12, bullet: true } },
  ], {
    x: MARGIN + 0.3, y: 4.0, w: 5.5, h: 2.7, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // body — right column
  card(s, MARGIN + 6.2, 3.35, 6.2, 3.4, C.card, C.amber);
  s.addText('What It Costs Today', {
    x: MARGIN + 6.5, y: 3.5, w: 5.6, h: 0.4,
    fontSize: 16, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText([
    { text: 'BEM Scale of Fees sets engineering consultancy fees at ', options: { color: C.text, fontSize: 12 } },
    { text: '0.9–3% of total project cost', options: { color: C.amber, fontSize: 12, bold: true, breakLine: true } },
    { text: ' ', options: { fontSize: 6, breakLine: true } },
    { text: 'On a RM 500,000 fluid system → ', options: { color: C.text, fontSize: 12 } },
    { text: 'RM 4,500–15,000 in engineering fees alone,', options: { color: C.amber, fontSize: 12, bold: true } },
    { text: ' plus weeks of waiting.', options: { color: C.text, fontSize: 12, breakLine: true } },
    { text: ' ', options: { fontSize: 6, breakLine: true } },
    { text: 'Generic AI tools (ChatGPT etc.) have no Malaysian supplier data, no DOSH/BOMBA compliance, and produce unstructured output engineers can\'t actually use.', options: { color: C.textMute, fontSize: 12, italic: true } },
  ], {
    x: MARGIN + 6.5, y: 4.0, w: 5.6, h: 2.7, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  footer(s, 'Sources: Board of Engineers Malaysia (BEM) — Scale of Fees Revision 2004 & Jan 2024 Registry · UMPSA News "Why Malaysia\'s Ir. is Stagnating" (2024) · bem.org.my');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — SOLUTION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '02', 'Feasibility Documentation in 4 Minutes',
    'Type a project description. Get a procurement-ready engineering specification — PE validates before stamping.');

  // Input → Pipeline → Output flow (3 columns)
  const colW = (W - MARGIN * 2 - 0.8) / 3;
  const colY = 1.55;
  const colH = 2.2;

  // Input
  card(s, MARGIN, colY, colW, colH, C.card, C.blueLite);
  s.addText('INPUT', {
    x: MARGIN + 0.25, y: colY + 0.2, w: colW - 0.4, h: 0.35,
    fontSize: 11, bold: true, color: C.blueLite, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText('Engineer fills a 1-screen form', {
    x: MARGIN + 0.25, y: colY + 0.55, w: colW - 0.4, h: 0.4,
    fontSize: 15, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText([
    { text: 'Industry', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Fluid type (40+ supported)', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Malaysian state', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Budget (RM)', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Optional: flow rate / volume', options: { color: C.text, fontSize: 11, bullet: true } },
  ], {
    x: MARGIN + 0.25, y: colY + 1.05, w: colW - 0.4, h: 1.1, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // Arrow 1
  s.addShape(pres.shapes.RIGHT_TRIANGLE, {
    x: MARGIN + colW + 0.05, y: colY + colH/2 - 0.15, w: 0.3, h: 0.3,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 }, rotate: 90,
  });

  // Pipeline
  card(s, MARGIN + colW + 0.4, colY, colW, colH, C.card, C.cyan);
  s.addText('AI PIPELINE', {
    x: MARGIN + colW + 0.65, y: colY + 0.2, w: colW - 0.4, h: 0.35,
    fontSize: 11, bold: true, color: C.cyan, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText('6 specialised agents + 12-check validation', {
    x: MARGIN + colW + 0.65, y: colY + 0.55, w: colW - 0.4, h: 0.5,
    fontSize: 14, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText([
    { text: 'Planner → Process parameters', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'BOM Agent → Malaysian suppliers', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Hydraulics → NPSH, Re, motor', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'HAZOP → 20+ guideword risks', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'Cost & P&ID → MYR + diagram', options: { color: C.text, fontSize: 11, bullet: true } },
  ], {
    x: MARGIN + colW + 0.65, y: colY + 1.15, w: colW - 0.4, h: 1.05, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // Arrow 2
  s.addShape(pres.shapes.RIGHT_TRIANGLE, {
    x: MARGIN + colW*2 + 0.45, y: colY + colH/2 - 0.15, w: 0.3, h: 0.3,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 }, rotate: 90,
  });

  // Output
  card(s, MARGIN + colW*2 + 0.8, colY, colW, colH, C.card, C.green);
  s.addText('OUTPUT', {
    x: MARGIN + colW*2 + 1.05, y: colY + 0.2, w: colW - 0.4, h: 0.35,
    fontSize: 11, bold: true, color: C.green, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText('Procurement-ready engineering package', {
    x: MARGIN + colW*2 + 1.05, y: colY + 0.55, w: colW - 0.4, h: 0.5,
    fontSize: 14, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText([
    { text: 'Complete BOM with MYR prices', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'HAZOP risk register', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'P&ID process flow diagram', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'AACE Class 4–5 cost estimate', options: { color: C.text, fontSize: 11, bullet: true, breakLine: true } },
    { text: 'PDF + Excel exports', options: { color: C.text, fontSize: 11, bullet: true } },
  ], {
    x: MARGIN + colW*2 + 1.05, y: colY + 1.15, w: colW - 0.4, h: 1.05, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // bottom positioning callout
  card(s, MARGIN, 4.1, W - MARGIN * 2, 2.5, C.cardAlt, C.blue);
  s.addText('AI for engineers — not vs engineers.', {
    x: MARGIN + 0.4, y: 4.3, w: W - MARGIN * 2 - 0.5, h: 0.55,
    fontSize: 22, bold: true, color: C.blueLite, fontFace: FONT_H,
    align: 'center', valign: 'middle', margin: 0,
  });
  s.addText('Flowid.ai automates the 60–80% documentation work. The PE keeps the engineering judgement — reviews, modifies, stamps. Total time from project description to stamped feasibility: hours, not weeks.', {
    x: MARGIN + 0.6, y: 4.95, w: W - MARGIN * 2 - 1.2, h: 1.5,
    fontSize: 14, color: C.text, fontFace: FONT_B,
    align: 'center', valign: 'top', margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — DEMO (placeholder for screenshots)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '03', 'Live Product — Not Mockups',
    'flowid-ai.vercel.app · generate a real Malaysian fluid system in under 4 minutes.');

  // 2×2 grid placeholders with annotations
  const items = [
    { title: 'BOM Table',         note: 'Real Malaysian suppliers: Grundfos, KITZ, Endress+Hauser, ABB. MYR pricing per item.', color: C.blueLite },
    { title: 'Process Flow (P&ID)', note: 'Auto-generated diagram showing equipment connections. Downloadable as SVG.',       color: C.violet },
    { title: 'Cost Breakdown',     note: 'AACE Class 4–5 methodology. Every line cites its source (BOM sum, Lang Factor).',    color: C.green },
    { title: 'Validation Notes',   note: '12 server-side integrity checks visible to the engineer. Trust, made visible.',     color: C.teal },
  ];

  const startX = MARGIN;
  const startY = 1.5;
  const cellW = (W - MARGIN * 2 - 0.4) / 2;
  const cellH = 2.5;

  items.forEach((item, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const x = startX + col * (cellW + 0.4);
    const y = startY + row * (cellH + 0.3);
    card(s, x, y, cellW, cellH, C.card, item.color);

    // "screenshot" placeholder area
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.25, y: y + 0.25, w: cellW - 0.5, h: cellH - 1.15,
      fill: { color: C.bgDark }, line: { color: C.border, width: 0.5 },
    });
    s.addText('[ screenshot placeholder ]', {
      x: x + 0.25, y: y + 0.25, w: cellW - 0.5, h: cellH - 1.15,
      fontSize: 10, italic: true, color: C.textDim, fontFace: FONT_B,
      align: 'center', valign: 'middle', margin: 0,
    });

    // title + note
    s.addText(item.title, {
      x: x + 0.25, y: y + cellH - 0.85, w: cellW - 0.5, h: 0.35,
      fontSize: 14, bold: true, color: item.color, fontFace: FONT_H, margin: 0,
    });
    s.addText(item.note, {
      x: x + 0.25, y: y + cellH - 0.5, w: cellW - 0.5, h: 0.4,
      fontSize: 10, color: C.textMute, fontFace: FONT_B, margin: 0,
    });
  });

  // bottom URL band
  s.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: H - 1.0, w: W - MARGIN * 2, h: 0.55,
    fill: { color: C.blue }, line: { color: C.blue, width: 0 },
  });
  s.addText('TRY IT LIVE  →  flowid-ai.vercel.app', {
    x: MARGIN, y: H - 1.0, w: W - MARGIN * 2, h: 0.55,
    fontSize: 16, bold: true, color: C.white, fontFace: FONT_H,
    align: 'center', valign: 'middle', charSpacing: 4, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '04', 'Multi-Agent Pipeline + 12-Check Validation',
    'Six specialised AI agents work the problem. A server-side validation layer audits every output.');

  // diagram placeholder
  card(s, MARGIN, 1.5, 6.0, 5.4, C.cardAlt, C.cyan);
  s.addText('[ Insert Agent Framework Diagram ]', {
    x: MARGIN + 0.3, y: 3.5, w: 5.4, h: 0.5,
    fontSize: 14, italic: true, color: C.textDim, fontFace: FONT_B,
    align: 'center', valign: 'middle', margin: 0,
  });
  s.addText('Diagram delivered separately as SVG / PNG — paste over this placeholder.', {
    x: MARGIN + 0.3, y: 4.05, w: 5.4, h: 0.4,
    fontSize: 10, italic: true, color: C.textDim, fontFace: FONT_B,
    align: 'center', valign: 'top', margin: 0,
  });

  // right side: agent list table
  const tx = MARGIN + 6.3;
  const tw = W - tx - MARGIN;
  card(s, tx, 1.5, tw, 5.4, C.card, C.blue);
  s.addText('SIX AGENTS', {
    x: tx + 0.3, y: 1.65, w: tw - 0.6, h: 0.35,
    fontSize: 11, bold: true, color: C.blueLite, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });

  const agents = [
    { name: 'Planner',     job: 'Process parameters, system type, scale' },
    { name: 'BOM',         job: 'Malaysian suppliers, sizing, MYR prices' },
    { name: 'Hydraulics',  job: 'NPSH, Reynolds, TDH, IEC motor sizing' },
    { name: 'HAZOP',       job: 'Guideword risks (≥20 entries, all required)' },
    { name: 'Cost',        job: 'AACE Class 4–5 + Lang Factor breakdown' },
    { name: 'P&ID',        job: 'Connected node-edge graph for diagram' },
  ];
  let y0 = 2.1;
  agents.forEach((a) => {
    s.addText(a.name, {
      x: tx + 0.3, y: y0, w: 1.6, h: 0.35,
      fontSize: 13, bold: true, color: C.cyan, fontFace: FONT_H, margin: 0,
    });
    s.addText(a.job, {
      x: tx + 1.9, y: y0, w: tw - 2.1, h: 0.35,
      fontSize: 11, color: C.text, fontFace: FONT_B, margin: 0,
    });
    y0 += 0.42;
  });

  // separator
  s.addShape(pres.shapes.LINE, {
    x: tx + 0.3, y: y0 + 0.05, w: tw - 0.6, h: 0,
    line: { color: C.border, width: 1 },
  });
  y0 += 0.2;

  s.addText('VALIDATION LAYER', {
    x: tx + 0.3, y: y0, w: tw - 0.6, h: 0.3,
    fontSize: 11, bold: true, color: C.green, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  y0 += 0.32;
  s.addText('12 server-side integrity checks · cost reconciled against BOM · math re-verified · material compatibility · HAZOP coverage · BOM↔P&ID consistency', {
    x: tx + 0.3, y: y0, w: tw - 0.6, h: 0.8,
    fontSize: 10, color: C.text, fontFace: FONT_B, margin: 0,
  });

  footer(s, 'AI fallback chain: Cerebras Qwen 235B → Mistral Medium → SambaNova Llama 3.3 70B · Firestore persistent storage');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — MARKET & IMPACT
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '05', 'Malaysia\'s Process Industry — Real Numbers',
    'Defined market, verifiable data, immediate productivity value.');

  // left: industry table
  const ltw = 7.5;
  card(s, MARGIN, 1.5, ltw, 5.4, C.card, C.blueLite);
  s.addText('TARGET INDUSTRIES', {
    x: MARGIN + 0.3, y: 1.65, w: ltw - 0.6, h: 0.35,
    fontSize: 11, bold: true, color: C.blueLite, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });

  const inds = [
    { sector: 'Palm Oil Mills',         scale: '446 mills nationwide (Statista, 2023)' },
    { sector: 'Oil & Gas',              scale: 'Pengerang RAPID, Petronas, Carigali — PETRONAS PTS-qualified' },
    { sector: 'Water Treatment',        scale: 'Municipal + industrial across 13 states' },
    { sector: 'Pharmaceuticals',        scale: 'GMP-regulated plants, Selangor / Penang' },
    { sector: 'Semiconductor / E&E',    scale: 'Penang FIZ — largest concentration in SE Asia' },
    { sector: 'Rubber & Latex',         scale: 'Kedah, Johor, Pahang — ammonia preservation systems' },
    { sector: 'Food & Beverage',        scale: 'CIP, steam, cooling across the country' },
  ];
  let y0 = 2.1;
  inds.forEach((it) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: MARGIN + 0.3, y: y0, w: 0.06, h: 0.4,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText(it.sector, {
      x: MARGIN + 0.5, y: y0, w: 2.4, h: 0.4,
      fontSize: 12, bold: true, color: C.white, fontFace: FONT_H, valign: 'middle', margin: 0,
    });
    s.addText(it.scale, {
      x: MARGIN + 2.9, y: y0, w: ltw - 3.2, h: 0.4,
      fontSize: 11, color: C.textMute, fontFace: FONT_B, valign: 'middle', margin: 0,
    });
    y0 += 0.5;
  });

  // right: TAM math
  const rtx = MARGIN + ltw + 0.4;
  const rtw = W - rtx - MARGIN;
  card(s, rtx, 1.5, rtw, 5.4, C.cardAlt, C.green);
  s.addText('PRODUCTIVITY VALUE', {
    x: rtx + 0.3, y: 1.65, w: rtw - 0.6, h: 0.35,
    fontSize: 11, bold: true, color: C.green, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText('Conservative TAM math', {
    x: rtx + 0.3, y: 2.05, w: rtw - 0.6, h: 0.4,
    fontSize: 14, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });

  s.addText([
    { text: '205,500', options: { color: C.green, fontSize: 22, bold: true, breakLine: true } },
    { text: 'Malaysian engineers (BEM, 2024)', options: { color: C.textMute, fontSize: 11, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: '×', options: { color: C.textDim, fontSize: 18, bold: true, breakLine: true } },
    { text: ' ', options: { fontSize: 4, breakLine: true } },
    { text: '10 hrs/wk', options: { color: C.green, fontSize: 22, bold: true, breakLine: true } },
    { text: 'documentation time saved', options: { color: C.textMute, fontSize: 11, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: '×', options: { color: C.textDim, fontSize: 18, bold: true, breakLine: true } },
    { text: ' ', options: { fontSize: 4, breakLine: true } },
    { text: 'RM 50/hr', options: { color: C.green, fontSize: 22, bold: true, breakLine: true } },
    { text: 'effective engineer hourly rate', options: { color: C.textMute, fontSize: 11 } },
  ], {
    x: rtx + 0.3, y: 2.55, w: rtw - 0.6, h: 3.8, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // bottom result band
  s.addShape(pres.shapes.RECTANGLE, {
    x: rtx + 0.3, y: 6.1, w: rtw - 0.6, h: 0.65,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
  s.addText('= RM 257M/year at 5% adoption', {
    x: rtx + 0.3, y: 6.1, w: rtw - 0.6, h: 0.65,
    fontSize: 13, bold: true, color: C.white, fontFace: FONT_H,
    align: 'center', valign: 'middle', margin: 0,
  });

  footer(s, 'Sources: Board of Engineers Malaysia Jan 2024 Registry · Statista "Malaysia palm oil mills 2023" · MIDA industry directories');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — COMPARISON
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '06', 'How Flowid.ai Compares',
    'Same engineering quality. Different time-and-cost reality.');

  const tableData = [
    [
      { text: 'Approach',     options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle' } },
      { text: 'Time',         options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle', align: 'center' } },
      { text: 'Cost',         options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle', align: 'center' } },
      { text: 'MY Suppliers', options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle', align: 'center' } },
      { text: 'Compliance',   options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle', align: 'center' } },
      { text: 'Structured',   options: { color: C.white, bold: true, fontSize: 11, fill: { color: C.bgDark }, valign: 'middle', align: 'center' } },
    ],
    [
      { text: 'Flowid.ai',                   options: { color: C.cyan,   bold: true, fontSize: 12, fill: { color: C.card }, valign: 'middle' } },
      { text: '< 4 min',                     options: { color: C.green,  bold: true, fontSize: 12, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: 'Free / RM 79–299/mo',         options: { color: C.green,  bold: true, fontSize: 11, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 16, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 16, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 16, fill: { color: C.card }, align: 'center', valign: 'middle' } },
    ],
    [
      { text: 'Engineering Consultant',      options: { color: C.text,   fontSize: 12, fill: { color: C.bgDark }, valign: 'middle' } },
      { text: '2–6 weeks',                   options: { color: C.amber,  fontSize: 12, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: 'RM 15,000–50,000',            options: { color: C.amber,  fontSize: 11, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
    ],
    [
      { text: 'Generic AI (ChatGPT etc.)',   options: { color: C.text,   fontSize: 12, fill: { color: C.card }, valign: 'middle' } },
      { text: '< 1 hour',                    options: { color: C.text,   fontSize: 12, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: 'Subscription',                options: { color: C.text,   fontSize: 11, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
    ],
    [
      { text: 'Excel Spreadsheet',           options: { color: C.text,   fontSize: 12, fill: { color: C.bgDark }, valign: 'middle' } },
      { text: '2–5 days',                    options: { color: C.amber,  fontSize: 12, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: "Engineer's time",             options: { color: C.text,   fontSize: 11, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.bgDark }, align: 'center', valign: 'middle' } },
    ],
    [
      { text: 'CAD Software (AVEVA, Bentley)',options: { color: C.text,  fontSize: 12, fill: { color: C.card }, valign: 'middle' } },
      { text: 'Weeks + training',            options: { color: C.amber,  fontSize: 12, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: 'RM 30,000+/year',             options: { color: C.amber,  fontSize: 11, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✗',                            options: { color: C.red,    bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
      { text: '✓',                            options: { color: C.green,  bold: true, fontSize: 14, fill: { color: C.card }, align: 'center', valign: 'middle' } },
    ],
  ];

  s.addTable(tableData, {
    x: MARGIN, y: 1.6, w: W - MARGIN * 2,
    colW: [3.2, 1.6, 2.6, 1.5, 1.5, 1.7],
    rowH: 0.55,
    border: { pt: 0.5, color: C.border },
    fontFace: FONT_B,
  });

  footer(s, 'Sources: BEM Scale of Fees (consultant cost) · AVEVA / Bentley public licensing · ChatGPT plans (chat.openai.com) · Flowid.ai live pricing model');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — RELIABILITY
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '07', 'Built for Engineering Integrity',
    'Every output passes through 12 server-side integrity checks. AI cannot quietly fabricate.');

  // 12 checks grid (3 columns × 4 rows)
  const checks = [
    { cat: 'COST',  txt: 'Equipment cost = verified BOM sum',  c: C.green },
    { cat: 'COST',  txt: 'No item > 50% of total (decimal err)',c: C.green },
    { cat: 'MATH',  txt: 'NPSH margin re-verified',             c: C.blueLite },
    { cat: 'MATH',  txt: 'TDH = static + friction',             c: C.blueLite },
    { cat: 'MATH',  txt: 'Reynolds re-computed',                c: C.blueLite },
    { cat: 'MATH',  txt: 'Flow regime matches Re',              c: C.blueLite },
    { cat: 'MATH',  txt: 'Motor size ≥ shaft (IEC 60034)',      c: C.blueLite },
    { cat: 'P&ID',  txt: 'BOM ↔ P&ID pump count consistent',    c: C.violet },
    { cat: 'P&ID',  txt: 'No orphan nodes in diagram',          c: C.violet },
    { cat: 'HAZOP', txt: 'Required guidewords covered',         c: C.amber },
    { cat: 'MATL',  txt: 'Fluid–material compatibility',        c: C.red },
    { cat: 'SUPPL', txt: 'Malaysian supplier pattern match',    c: C.teal },
  ];

  const startX = MARGIN;
  const startY = 1.55;
  const cw = (W - MARGIN * 2 - 0.4) / 3;
  const ch = 0.75;
  const gap = 0.15;

  checks.forEach((chk, idx) => {
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    const x = startX + c * (cw + 0.2);
    const y = startY + r * (ch + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cw, h: ch,
      fill: { color: C.card }, line: { color: C.border, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: ch,
      fill: { color: chk.c }, line: { color: chk.c, width: 0 },
    });
    s.addText(chk.cat, {
      x: x + 0.2, y: y + 0.08, w: cw - 0.3, h: 0.25,
      fontSize: 9, bold: true, color: chk.c, fontFace: FONT_H, charSpacing: 3, margin: 0,
    });
    s.addText(chk.txt, {
      x: x + 0.2, y: y + 0.32, w: cw - 0.3, h: 0.4,
      fontSize: 11, color: C.text, fontFace: FONT_B, margin: 0,
    });
  });

  // bottom band: methodology
  card(s, MARGIN, 5.55, W - MARGIN * 2, 1.2, C.cardAlt, C.cyan);
  s.addText('METHODOLOGY GROUNDED IN ESTABLISHED STANDARDS', {
    x: MARGIN + 0.3, y: 5.65, w: W - MARGIN * 2 - 0.6, h: 0.3,
    fontSize: 10, bold: true, color: C.cyan, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText([
    { text: 'AACE International Class 4–5', options: { color: C.white, fontSize: 11, bold: true } },
    { text: ' for cost classification · ', options: { color: C.textMute, fontSize: 11 } },
    { text: 'Lang Factor / Hand\'s Method', options: { color: C.white, fontSize: 11, bold: true } },
    { text: ' for installation & engineering ratios · ', options: { color: C.textMute, fontSize: 11 } },
    { text: 'API 610', options: { color: C.white, fontSize: 11, bold: true } },
    { text: ' for NPSH · ', options: { color: C.textMute, fontSize: 11 } },
    { text: 'IEC 60034', options: { color: C.white, fontSize: 11, bold: true } },
    { text: ' for motor sizing · ', options: { color: C.textMute, fontSize: 11 } },
    { text: 'DOSH FMA 1967, BOMBA UBBL, SIRIM QAS, PETRONAS PTS', options: { color: C.white, fontSize: 11, bold: true } },
    { text: ' for compliance citations', options: { color: C.textMute, fontSize: 11 } },
  ], {
    x: MARGIN + 0.3, y: 5.95, w: W - MARGIN * 2 - 0.6, h: 0.75,
    fontFace: FONT_B, margin: 0, valign: 'top',
  });

  footer(s, 'Zod schema validation (Pydantic-equivalent) · Firestore persistent storage · feasibility tool, not stamped design — PE remains in the loop');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — BUSINESS MODEL
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '08', 'Free for Adoption. Paid for Reliability.',
    'The features that make output 100% trustworthy sit behind the paid tier.');

  const tierW = (W - MARGIN * 2 - 0.6) / 3;
  const tierY = 1.5;
  const tierH = 5.4;

  // FREE
  {
    const x = MARGIN;
    card(s, x, tierY, tierW, tierH, C.card, C.textMute);
    s.addText('FREE', {
      x: x + 0.3, y: tierY + 0.25, w: tierW - 0.6, h: 0.4,
      fontSize: 14, bold: true, color: C.textMute, fontFace: FONT_H, charSpacing: 4, margin: 0,
    });
    s.addText('RM 0', {
      x: x + 0.3, y: tierY + 0.65, w: tierW - 0.6, h: 0.7,
      fontSize: 32, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
    });
    s.addText('Forever · 3 projects/month', {
      x: x + 0.3, y: tierY + 1.35, w: tierW - 0.6, h: 0.3,
      fontSize: 11, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: x + 0.3, y: tierY + 1.75, w: tierW - 0.6, h: 0,
      line: { color: C.border, width: 1 },
    });

    s.addText([
      { text: '✓ Basic BOM generation', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✓ MYR pricing', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✓ Malaysian supplier names', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✓ Basic PDF export', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✓ Compliance citations', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✗ No HAZOP register', options: { color: C.textDim, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✗ No confidence scores', options: { color: C.textDim, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✗ No alternatives', options: { color: C.textDim, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✗ No P&ID diagram', options: { color: C.textDim, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
      { text: '✗ No validation audit', options: { color: C.textDim, fontSize: 11 } },
    ], {
      x: x + 0.3, y: tierY + 1.9, w: tierW - 0.6, h: 3.4, fontFace: FONT_B, margin: 0, valign: 'top',
    });
  }

  // PROFESSIONAL — recommended
  {
    const x = MARGIN + tierW + 0.3;
    card(s, x, tierY - 0.15, tierW, tierH + 0.3, C.cardAlt, C.cyan);
    // recommended badge
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + tierW/2 - 1.0, y: tierY - 0.4, w: 2.0, h: 0.35,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText('RECOMMENDED', {
      x: x + tierW/2 - 1.0, y: tierY - 0.4, w: 2.0, h: 0.35,
      fontSize: 10, bold: true, color: C.bgDark, fontFace: FONT_H,
      align: 'center', valign: 'middle', charSpacing: 3, margin: 0,
    });

    s.addText('PROFESSIONAL', {
      x: x + 0.3, y: tierY + 0.15, w: tierW - 0.6, h: 0.4,
      fontSize: 14, bold: true, color: C.cyan, fontFace: FONT_H, charSpacing: 4, margin: 0,
    });
    s.addText('RM 79', {
      x: x + 0.3, y: tierY + 0.55, w: tierW - 0.6, h: 0.75,
      fontSize: 36, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
    });
    s.addText('per engineer / month', {
      x: x + 0.3, y: tierY + 1.3, w: tierW - 0.6, h: 0.3,
      fontSize: 11, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
    });
    s.addText('Unlimited projects · all reliability features', {
      x: x + 0.3, y: tierY + 1.55, w: tierW - 0.6, h: 0.3,
      fontSize: 10, color: C.cyan, fontFace: FONT_B, margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: x + 0.3, y: tierY + 1.95, w: tierW - 0.6, h: 0,
      line: { color: C.border, width: 1 },
    });

    s.addText([
      { text: '✓ Everything in Free, plus:', options: { color: C.textMute, fontSize: 10, italic: true, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ HAZOP Risk Register (20+)', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ AI confidence scores', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Component alternatives', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ P&ID diagram (SVG)', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ 12-check validation', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Engineering math verified', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Material compatibility', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Engineer Action Plan', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Excel BOM export', options: { color: C.green, fontSize: 11 } },
    ], {
      x: x + 0.3, y: tierY + 2.1, w: tierW - 0.6, h: 3.3, fontFace: FONT_B, margin: 0, valign: 'top',
    });
  }

  // ENTERPRISE
  {
    const x = MARGIN + (tierW + 0.3) * 2;
    card(s, x, tierY, tierW, tierH, C.card, C.violet);
    s.addText('TEAM / ENTERPRISE', {
      x: x + 0.3, y: tierY + 0.25, w: tierW - 0.6, h: 0.4,
      fontSize: 14, bold: true, color: C.violet, fontFace: FONT_H, charSpacing: 3, margin: 0,
    });
    s.addText('RM 299+', {
      x: x + 0.3, y: tierY + 0.65, w: tierW - 0.6, h: 0.7,
      fontSize: 28, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
    });
    s.addText('per month · up to 5 seats', {
      x: x + 0.3, y: tierY + 1.35, w: tierW - 0.6, h: 0.3,
      fontSize: 11, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
    });
    s.addText('Custom pricing for >5 seats', {
      x: x + 0.3, y: tierY + 1.6, w: tierW - 0.6, h: 0.3,
      fontSize: 10, color: C.violet, fontFace: FONT_B, margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: x + 0.3, y: tierY + 1.95, w: tierW - 0.6, h: 0,
      line: { color: C.border, width: 1 },
    });

    s.addText([
      { text: '✓ Everything in Professional, plus:', options: { color: C.textMute, fontSize: 10, italic: true, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Multi-user team workspace', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Shared project library', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Custom supplier directory', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ White-label PDF reports', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Priority AI infrastructure', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ API access', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Dedicated support engineer', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ Onboarding + training', options: { color: C.green, fontSize: 11, breakLine: true, paraSpaceAfter: 5 } },
      { text: '✓ SLA + invoicing', options: { color: C.green, fontSize: 11 } },
    ], {
      x: x + 0.3, y: tierY + 2.1, w: tierW - 0.6, h: 3.3, fontFace: FONT_B, margin: 0, valign: 'top',
    });
  }

  footer(s, 'Logic: free tier gets engineers using the tool; paid tier delivers the rigor that makes output 100% trustworthy for procurement decisions');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — TEAM
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '09', 'Built in 4 Days, by 2 Malaysian Engineers',
    'Mechatronics + multimedia. Built BY engineers, FOR engineers.');

  // Ali card
  const cardW = (W - MARGIN * 2 - 0.5) / 2;
  card(s, MARGIN, 1.6, cardW, 3.5, C.card, C.blueLite);
  // initials avatar
  s.addShape(pres.shapes.OVAL, {
    x: MARGIN + 0.4, y: 1.85, w: 1.2, h: 1.2,
    fill: { color: C.blue }, line: { color: C.blueLite, width: 1 },
  });
  s.addText('AG', {
    x: MARGIN + 0.4, y: 1.85, w: 1.2, h: 1.2,
    fontSize: 36, bold: true, color: C.white, fontFace: FONT_H,
    align: 'center', valign: 'middle', margin: 0,
  });
  s.addText('Ali Ghalab', {
    x: MARGIN + 1.85, y: 1.95, w: cardW - 2.0, h: 0.5,
    fontSize: 22, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText('Mechatronics Engineer', {
    x: MARGIN + 1.85, y: 2.45, w: cardW - 2.0, h: 0.35,
    fontSize: 13, color: C.blueLite, fontFace: FONT_B, margin: 0,
  });
  s.addText('Full-stack development · AI integration · system architecture · backend reliability', {
    x: MARGIN + 1.85, y: 2.8, w: cardW - 2.0, h: 0.5,
    fontSize: 11, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
  });

  s.addShape(pres.shapes.LINE, {
    x: MARGIN + 0.4, y: 3.4, w: cardW - 0.7, h: 0,
    line: { color: C.border, width: 1 },
  });
  s.addText([
    { text: '✉  alimohamedrefai@gmail.com', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
    { text: '☎  +60 17-335 6536', options: { color: C.text, fontSize: 11 } },
  ], {
    x: MARGIN + 0.4, y: 3.55, w: cardW - 0.7, h: 1.0, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // Amr card
  const x2 = MARGIN + cardW + 0.5;
  card(s, x2, 1.6, cardW, 3.5, C.card, C.violet);
  s.addShape(pres.shapes.OVAL, {
    x: x2 + 0.4, y: 1.85, w: 1.2, h: 1.2,
    fill: { color: C.violet }, line: { color: C.cyan, width: 1 },
  });
  s.addText('AG', {
    x: x2 + 0.4, y: 1.85, w: 1.2, h: 1.2,
    fontSize: 36, bold: true, color: C.white, fontFace: FONT_H,
    align: 'center', valign: 'middle', margin: 0,
  });
  s.addText('Amr Ghalab', {
    x: x2 + 1.85, y: 1.95, w: cardW - 2.0, h: 0.5,
    fontSize: 22, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText('Multimedia Technician', {
    x: x2 + 1.85, y: 2.45, w: cardW - 2.0, h: 0.35,
    fontSize: 13, color: C.violet, fontFace: FONT_B, margin: 0,
  });
  s.addText('UI / UX design · brand identity · pitch material · multimedia production', {
    x: x2 + 1.85, y: 2.8, w: cardW - 2.0, h: 0.5,
    fontSize: 11, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
  });

  s.addShape(pres.shapes.LINE, {
    x: x2 + 0.4, y: 3.4, w: cardW - 0.7, h: 0,
    line: { color: C.border, width: 1 },
  });
  s.addText([
    { text: '✉  amrmohamedrefai@gmail.com', options: { color: C.text, fontSize: 11, breakLine: true, paraSpaceAfter: 6 } },
    { text: '☎  +60 19-935 6380', options: { color: C.text, fontSize: 11 } },
  ], {
    x: x2 + 0.4, y: 3.55, w: cardW - 0.7, h: 1.0, fontFace: FONT_B, margin: 0, valign: 'top',
  });

  // Stack delivered band
  card(s, MARGIN, 5.3, W - MARGIN * 2, 1.4, C.cardAlt, C.green);
  s.addText('STACK DELIVERED IN 4 DAYS', {
    x: MARGIN + 0.3, y: 5.4, w: W - MARGIN * 2 - 0.6, h: 0.3,
    fontSize: 10, bold: true, color: C.green, fontFace: FONT_H, charSpacing: 4, margin: 0,
  });
  s.addText('Next.js 15 + TypeScript + Tailwind · Firebase Auth + Firestore · 3-provider AI fallback (Cerebras, Mistral, SambaNova) · 12-check server-side validation · Process Flow Diagram (Mermaid.js + SVG export) · PDF & Excel exports · multi-agent loading UI · Zod schema enforcement',
  {
    x: MARGIN + 0.3, y: 5.7, w: W - MARGIN * 2 - 0.6, h: 0.95,
    fontSize: 11, color: C.text, fontFace: FONT_B, margin: 0, valign: 'top',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — ROADMAP
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkBg(s);
  header(s, '10', 'What Comes Next',
    'Phase 2 — if Flowid.ai earns its place to keep building.');

  // 3 columns: Near-term · Medium-term · Long-term
  const colW = (W - MARGIN * 2 - 0.6) / 3;
  const y0 = 1.55;
  const colH = 5.0;

  const phases = [
    {
      label: 'NEXT 30 DAYS',
      colour: C.blueLite,
      items: [
        'AI chatbot for project Q&A and inline corrections',
        '"Use This Alternative" — regenerate plan around chosen alternative',
        'Beta program with 5 Malaysian EPC partners',
        'PDF export improvements & branded templates',
      ],
    },
    {
      label: 'NEXT 90 DAYS',
      colour: C.cyan,
      items: [
        'OEM catalogue cross-reference (verify model numbers)',
        'Equipment data sheets — 1 page per component',
        'Multi-language support (Bahasa Malaysia, Mandarin)',
        'Live pricing via richer supplier APIs',
      ],
    },
    {
      label: 'NEXT 6 MONTHS',
      colour: C.violet,
      items: [
        'Trademark clearance and commercial brand consolidation',
        'On-prem deployment for data-sovereign clients',
        'PETRONAS PTS pre-qualified document templates',
        'Engineering firm partnerships and white-label option',
      ],
    },
  ];

  phases.forEach((p, idx) => {
    const x = MARGIN + idx * (colW + 0.3);
    card(s, x, y0, colW, colH, C.card, p.colour);
    s.addText(p.label, {
      x: x + 0.3, y: y0 + 0.2, w: colW - 0.6, h: 0.35,
      fontSize: 11, bold: true, color: p.colour, fontFace: FONT_H, charSpacing: 4, margin: 0,
    });

    let yy = y0 + 0.7;
    p.items.forEach((it) => {
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.3, y: yy + 0.05, w: 0.15, h: 0.15,
        fill: { color: p.colour }, line: { color: p.colour, width: 0 },
      });
      s.addText(it, {
        x: x + 0.55, y: yy - 0.05, w: colW - 0.85, h: 0.9,
        fontSize: 11, color: C.text, fontFace: FONT_B, valign: 'top', margin: 0,
      });
      yy += 1.0;
    });
  });

  footer(s, 'Today\'s MVP is honest about what it is — a feasibility tool. Tomorrow\'s version closes the gap to procurement-grade output.');
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — THANK YOU (excluded from count)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkerBg(s);

  s.addText('Thank You', {
    x: MARGIN, y: 1.8, w: W - MARGIN * 2, h: 1.3,
    fontSize: 84, bold: true, color: C.white, fontFace: FONT_H,
    align: 'left', valign: 'middle', margin: 0,
  });

  // accent stripe
  s.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: 3.2, w: 1.4, h: 0.08,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });

  s.addText('Try Flowid.ai now → flowid-ai.vercel.app', {
    x: MARGIN, y: 3.4, w: W - MARGIN * 2, h: 0.5,
    fontSize: 22, color: C.text, fontFace: FONT_H, margin: 0,
  });

  s.addText('Questions, partnerships, or pilot interest?', {
    x: MARGIN, y: 4.4, w: W - MARGIN * 2, h: 0.4,
    fontSize: 16, italic: true, color: C.textMute, fontFace: FONT_B, margin: 0,
  });

  // contact cards
  const cy = 5.0;
  const ch = 1.5;
  const cwid = (W - MARGIN * 2 - 0.4) / 2;
  card(s, MARGIN, cy, cwid, ch, C.card, C.blueLite);
  s.addText('Ali Ghalab', {
    x: MARGIN + 0.3, y: cy + 0.15, w: cwid - 0.6, h: 0.4,
    fontSize: 16, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText('Mechatronics Engineer', {
    x: MARGIN + 0.3, y: cy + 0.5, w: cwid - 0.6, h: 0.3,
    fontSize: 11, color: C.blueLite, fontFace: FONT_B, margin: 0,
  });
  s.addText('alimohamedrefai@gmail.com  ·  +60 17-335 6536', {
    x: MARGIN + 0.3, y: cy + 0.85, w: cwid - 0.6, h: 0.4,
    fontSize: 11, color: C.text, fontFace: FONT_B, margin: 0,
  });

  card(s, MARGIN + cwid + 0.4, cy, cwid, ch, C.card, C.violet);
  s.addText('Amr Ghalab', {
    x: MARGIN + cwid + 0.7, y: cy + 0.15, w: cwid - 0.6, h: 0.4,
    fontSize: 16, bold: true, color: C.white, fontFace: FONT_H, margin: 0,
  });
  s.addText('Multimedia Technician', {
    x: MARGIN + cwid + 0.7, y: cy + 0.5, w: cwid - 0.6, h: 0.3,
    fontSize: 11, color: C.violet, fontFace: FONT_B, margin: 0,
  });
  s.addText('amrmohamedrefai@gmail.com  ·  +60 19-935 6380', {
    x: MARGIN + cwid + 0.7, y: cy + 0.85, w: cwid - 0.6, h: 0.4,
    fontSize: 11, color: C.text, fontFace: FONT_B, margin: 0,
  });

  // AIC stamp at bottom
  s.addText('AIC HACKATHON 2026  ·  Slido: 2311517', {
    x: MARGIN, y: H - 0.55, w: W - MARGIN * 2, h: 0.35,
    fontSize: 10, color: C.textDim, fontFace: FONT_H,
    align: 'center', valign: 'middle', charSpacing: 4, margin: 0,
  });
}

// ─── SAVE ──────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: 'pitch/Flowid_AI_Pitch_Deck.pptx' })
  .then((f) => console.log(`\n✓ Pitch deck generated: ${f}\n`))
  .catch((e) => { console.error('FAILED:', e); process.exit(1); });
