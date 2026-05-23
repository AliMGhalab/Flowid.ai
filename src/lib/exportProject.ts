/**
 * exportProject.ts
 * PDF and Excel export for Flowid.ai fluid system engineering reports.
 * Both functions use dynamic imports to avoid bloating the initial bundle.
 */

import type { Project } from '@/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (!n && n !== 0) return '—';
  return 'RM ' + new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(n);
}

function cap(s: string | undefined | null): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function safeStr(v: unknown): string {
  if (v === undefined || v === null) return '—';
  return String(v);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportToPDF(project: Project): Promise<void> {
  // Dynamically import to avoid SSR/bundle issues
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const rec = project.recommendation!;
  const input = project.input;
  const est = rec.cost_estimate;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const MARGIN = 16;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BRAND_BLUE = [37, 99, 235] as [number, number, number];   // #2563eb
  const SLATE_900 = [15, 23, 42] as [number, number, number];
  const SLATE_600 = [71, 85, 105] as [number, number, number];
  const SLATE_300 = [203, 213, 225] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];
  const GREEN = [34, 197, 94] as [number, number, number];

  let y = 0;

  function addPage() {
    doc.addPage();
    y = MARGIN;
    // page header stripe
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(0, 0, PAGE_W, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('FLOWID.AI — CONFIDENTIAL ENGINEERING REPORT', MARGIN, 5.5);
    doc.text(`${project.projectName}`, PAGE_W - MARGIN, 5.5, { align: 'right' });
    y = 14;
  }

  function checkY(needed: number) {
    if (y + needed > 280) addPage();
  }

  function sectionHeader(title: string, color: [number, number, number] = BRAND_BLUE) {
    checkY(12);
    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(title.toUpperCase(), MARGIN + 4, y + 5.3);
    y += 11;
  }

  // ── Cover page ──────────────────────────────────────────────────────────────

  // Top gradient band
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, PAGE_W, 70, 'F');

  // Logo / brand
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('FLOWID.AI', MARGIN, 24);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 210, 255);
  doc.text('AI-Powered Fluid System Engineering', MARGIN, 30);

  // Divider
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 34, PAGE_W - MARGIN, 34);

  // Report title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  const titleLines = doc.splitTextToSize(project.projectName, CONTENT_W);
  doc.text(titleLines, MARGIN, 42);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 210, 255);
  doc.text('Fluid System Engineering Report', MARGIN, 42 + titleLines.length * 7 + 2);

  // Cover meta block
  y = 80;
  doc.setFontSize(9);

  const coverMeta: Array<[string, string]> = [
    ['Report Date', formatDate(new Date())],
    ['Project Created', formatDate(project.createdAt)],
    ['Industry', safeStr(input.industry)],
    ['Fluid Type', input.fluidType === 'chemical' || input.fluidType === 'other' ? safeStr(input.customFluidType) : cap(input.fluidType)],
    ['Location', `${cap(input.malaysiaState)}, Malaysia`],
    ['Site Environment', cap(input.siteEnvironment)],
    ['Project Budget', fmt(input.budget)],
    ['System Type', safeStr(rec.system_type)],
    ['Lead Time', `${rec.lead_time_weeks} weeks`],
    ['Total Cost Estimate', fmt(est?.total_cost_myr ?? est?.total_cost_usd)],
    ['Budget Status', (est?.within_budget !== false) ? '✓ Within Budget' : '✗ Exceeds Budget'],
    ['Overall Risk', cap(rec.risk_assessment?.overall_risk_level)],
    ...(rec.overall_confidence !== undefined ? [['AI Confidence', `${rec.overall_confidence}%`] as [string, string]] : []),
  ];

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y - 4, CONTENT_W, coverMeta.length * 8 + 8, 2, 2, 'F');
  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y - 4, CONTENT_W, coverMeta.length * 8 + 8, 2, 2, 'S');

  for (const [label, value] of coverMeta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_600);
    doc.text(label + ':', MARGIN + 4, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_900);
    doc.text(safeStr(value), MARGIN + 60, y + 3);
    y += 8;
  }

  y += 12;

  // Summary box
  if (rec.summary) {
    doc.setFillColor(239, 246, 255);
    const summaryLines = doc.splitTextToSize(rec.summary, CONTENT_W - 8);
    const summaryH = summaryLines.length * 4.5 + 8;
    if (y + summaryH < 265) {
      doc.roundedRect(MARGIN, y, CONTENT_W, summaryH, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE_900);
      doc.text(summaryLines, MARGIN + 4, y + 6);
      y += summaryH + 4;
    }
  }

  // Footer on cover
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...SLATE_600);
  doc.text(
    'This report is generated by Flowid.ai AI engine and is intended for engineering feasibility purposes only. All recommendations should be validated by a licensed professional engineer before implementation.',
    MARGIN,
    285,
    { maxWidth: CONTENT_W }
  );

  // ── Page 2: Process Parameters + Design Basis ─────────────────────────────

  addPage();

  sectionHeader('1. Design Basis & Process Parameters');

  if (rec.design_basis) {
    const dbLines = doc.splitTextToSize(rec.design_basis, CONTENT_W);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_900);
    checkY(dbLines.length * 4.5 + 6);
    doc.text(dbLines, MARGIN, y);
    y += dbLines.length * 4.5 + 6;
  }

  if (rec.process_parameters) {
    const pp = rec.process_parameters;
    const params: Array<[string, string]> = [
      ['Design Flow Rate', safeStr(pp.design_flow_rate)],
      ['Operating Pressure', safeStr(pp.operating_pressure)],
      ['Design Pressure', safeStr(pp.design_pressure)],
      ['Operating Temperature', safeStr(pp.operating_temperature)],
      ['Design Temperature', safeStr(pp.design_temperature)],
      ['Fluid Velocity', safeStr(pp.fluid_velocity)],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Parameter', 'Value']],
      body: params,
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: SLATE_900 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    if (pp.basis) {
      checkY(16);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...SLATE_600);
      const basisLines = doc.splitTextToSize('Engineering basis: ' + pp.basis, CONTENT_W);
      doc.text(basisLines, MARGIN, y);
      y += basisLines.length * 4 + 4;
    }
  }

  // Scale inputs if present
  const hasScale = input.scaleFlowRateValue || input.scaleVolumeMonthlyValue;
  if (hasScale) {
    checkY(20);
    y += 2;
    sectionHeader('1.1 User-Specified Scale Parameters', [51, 65, 85]);
    const scaleRows: string[][] = [];
    if (input.scaleFlowRateValue) scaleRows.push(['Flow Rate', `${input.scaleFlowRateValue} ${input.scaleFlowRateUnit ?? ''}`]);
    if (input.scaleVolumeMonthlyValue) scaleRows.push(['Monthly Volume', `${input.scaleVolumeMonthlyValue} ${input.scaleVolumeMonthlyUnit ?? ''}`]);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Parameter', 'Value']],
      body: scaleRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: WHITE, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Bill of Materials ─────────────────────────────────────────────────────

  addPage();
  sectionHeader('2. Bill of Materials (BOM)');

  const bomBody = (rec.components ?? []).map((c) => [
    c.id,
    c.name,
    cap(c.category),
    String(c.quantity),
    c.specification,
    c.material,
    c.supplier,
    c.model,
    fmt(c.unit_cost_myr ?? c.unit_cost_usd),
    fmt(c.total_cost_myr ?? c.total_cost_usd),
    c.confidence_level !== undefined ? `${c.confidence_level}%` : '—',
    c.lifespan_years ? `${c.lifespan_years} yr` : '—',
    c.notes ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['ID', 'Component', 'Category', 'Qty', 'Specification', 'Material', 'Supplier', 'Model', 'Unit Cost', 'Total Cost', 'Confidence', 'Lifespan', 'Notes']],
    body: bomBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5, textColor: SLATE_900, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 16 },
      3: { cellWidth: 7, halign: 'center' },
      4: { cellWidth: 28 },
      5: { cellWidth: 16 },
      6: { cellWidth: 18 },
      7: { cellWidth: 16 },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 14, halign: 'center' },
      11: { cellWidth: 13, halign: 'center' },
      12: { cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // BOM subtotal
  const bomTotal = (rec.components ?? []).reduce((sum, c) => sum + (c.total_cost_myr ?? c.total_cost_usd ?? 0), 0);
  checkY(10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_900);
  doc.text('Equipment Subtotal:', PAGE_W - MARGIN - 60, y + 4);
  doc.setTextColor(22, 163, 74);
  doc.text(fmt(bomTotal), PAGE_W - MARGIN, y + 4, { align: 'right' });
  y += 12;

  // ── Alternatives ──────────────────────────────────────────────────────────

  const altsData: string[][] = [];
  for (const c of rec.components ?? []) {
    for (const alt of c.alternatives ?? []) {
      altsData.push([
        c.id,
        c.name,
        alt.name,
        alt.supplier,
        alt.model,
        fmt(alt.unit_cost_myr),
        fmt(alt.total_cost_myr),
        alt.confidence_level !== undefined ? `${alt.confidence_level}%` : '—',
        alt.reason,
      ]);
    }
  }

  if (altsData.length > 0) {
    checkY(20);
    sectionHeader('3. Component Alternatives');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Ref ID', 'Primary', 'Alternative', 'Supplier', 'Model', 'Unit Cost', 'Total Cost', 'Confidence', 'Reason']],
      body: altsData,
      theme: 'striped',
      headStyles: { fillColor: [180, 83, 9], textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 6.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 26 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 16, halign: 'right' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 40 },
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Piping & Instrumentation ───────────────────────────────────────────────

  addPage();
  sectionHeader('4. Piping Specification');

  if (rec.piping) {
    const p = rec.piping;
    const pipingData: string[][] = [
      ['Material', safeStr(p.material)],
      ['Nominal Diameter', `${p.nominal_diameter_inch}"`],
      ['Schedule', `Sch. ${p.schedule}`],
      ['Connection Type', safeStr(p.connection_type)],
      ['Insulation Required', p.insulation_required ? 'Yes' : 'No'],
      ['Insulation Type', p.insulation_type ?? '—'],
      ['Design Notes', safeStr(p.design_notes)],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Parameter', 'Value']],
      body: pipingData,
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if ((rec.instrumentation ?? []).length > 0) {
    checkY(20);
    sectionHeader('5. Instrumentation List');
    const instBody = rec.instrumentation.map((i) => [
      i.tag,
      i.description,
      i.type,
      i.service,
      i.range,
      i.material,
      i.supplier,
      fmt(i.unit_cost_myr ?? i.unit_cost_usd),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Tag', 'Description', 'Type', 'Service', 'Range', 'Material', 'Supplier', 'Unit Cost']],
      body: instBody,
      theme: 'striped',
      headStyles: { fillColor: [6, 182, 212], textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold', textColor: [6, 182, 212] },
        1: { cellWidth: 36 },
        2: { cellWidth: 22 },
        3: { cellWidth: 24 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [236, 254, 255] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Risk Assessment ───────────────────────────────────────────────────────

  addPage();
  sectionHeader('6. Risk Assessment (HAZOP)');

  const ra = rec.risk_assessment;
  if (ra) {
    checkY(14);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_600);
    doc.text('Overall Risk Level:', MARGIN, y + 4);
    doc.setFont('helvetica', 'normal');
    const rlColor: Record<string, [number, number, number]> = {
      low: [22, 163, 74],
      medium: [234, 179, 8],
      high: [249, 115, 22],
      critical: [220, 38, 38],
    };
    doc.setTextColor(...(rlColor[ra.overall_risk_level] ?? rlColor.low));
    doc.text(cap(ra.overall_risk_level), MARGIN + 38, y + 4);
    y += 7;

    if (ra.hazop_summary) {
      const hLines = doc.splitTextToSize(ra.hazop_summary, CONTENT_W);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_600);
      doc.text(hLines, MARGIN, y);
      y += hLines.length * 4 + 4;
    }

    const riskBody = (ra.risks ?? []).map((r) => [
      r.id,
      cap(r.category),
      r.hazard,
      r.cause,
      cap(r.likelihood),
      cap(r.severity),
      cap(r.risk_level),
      r.safeguard ?? '—',
      r.mitigation,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['ID', 'Category', 'Hazard', 'Cause', 'Likelihood', 'Severity', 'Risk', 'Safeguard', 'Mitigation']],
      body: riskBody,
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28], textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 6.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: 'bold' },
        1: { cellWidth: 18 },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 22 },
        8: { cellWidth: 32 },
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Maintenance Schedule ───────────────────────────────────────────────────

  addPage();
  sectionHeader('7. Maintenance Schedule');

  const order = ['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'];
  const sorted = [...(rec.maintenance_schedule ?? [])].sort(
    (a, b) => order.indexOf(a.frequency) - order.indexOf(b.frequency)
  );

  const maintBody: string[][] = [];
  for (const entry of sorted) {
    for (const task of entry.tasks ?? []) {
      maintBody.push([
        cap(entry.frequency),
        task.task,
        task.procedure ?? '—',
        `${task.estimated_duration_hours}h`,
        task.requires_shutdown ? 'Yes' : 'No',
      ]);
    }
  }

  if (maintBody.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Frequency', 'Task', 'Procedure', 'Duration', 'Shutdown?']],
      body: maintBody,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 36 },
        2: { cellWidth: 80 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [238, 242, 255] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Cost Estimate ─────────────────────────────────────────────────────────

  addPage();
  sectionHeader('8. Cost Estimate Summary');

  if (est) {
    const equip = est.equipment_cost_myr ?? est.equipment_cost_usd ?? 0;
    const transport = est.transportation_cost_myr ?? 0;
    const install = est.installation_cost_myr ?? est.installation_cost_usd ?? 0;
    const eng = est.engineering_cost_myr ?? est.engineering_cost_usd ?? 0;
    const comm = est.commissioning_cost_myr ?? est.commissioning_cost_usd ?? 0;
    const total = est.total_cost_myr ?? est.total_cost_usd ?? 0;
    const budgetUsed = total > 0 && project.input.budget > 0 ? ((total / project.input.budget) * 100).toFixed(1) : '—';

    const costRows = [
      ['Equipment', fmt(equip), total > 0 ? `${((equip / total) * 100).toFixed(1)}%` : '—'],
      ['Transportation & Logistics', fmt(transport), total > 0 && transport > 0 ? `${((transport / total) * 100).toFixed(1)}%` : '—'],
      ['Installation', fmt(install), total > 0 ? `${((install / total) * 100).toFixed(1)}%` : '—'],
      ['Engineering', fmt(eng), total > 0 ? `${((eng / total) * 100).toFixed(1)}%` : '—'],
      ['Commissioning & Start-up', fmt(comm), total > 0 ? `${((comm / total) * 100).toFixed(1)}%` : '—'],
      ['TOTAL PROJECT COST', fmt(total), '100%'],
    ].filter((r) => r[1] !== '—' || r[0] === 'TOTAL PROJECT COST');

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Cost Item', 'Amount (MYR)', '% of Total']],
      body: costRows,
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 38, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      didParseCell: (data) => {
        if (data.row.index === costRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fillColor = [240, 253, 244];
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Budget status
    checkY(18);
    const budgetFill: [number, number, number] = est.within_budget !== false ? [240, 253, 244] : [254, 242, 242];
    const budgetText: [number, number, number] = est.within_budget !== false ? GREEN : [220, 38, 38];
    doc.setFillColor(...budgetFill);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...budgetText);
    doc.text(
      est.within_budget !== false ? '✓ WITHIN BUDGET' : '✗ EXCEEDS BUDGET',
      MARGIN + 4, y + 6
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_600);
    doc.text(`Budget: ${fmt(project.input.budget)}  ·  Estimated: ${fmt(total)}  ·  Usage: ${budgetUsed}%`, MARGIN + 4, y + 11);
    y += 18;

    if (est.budget_notes) {
      checkY(14);
      const bnLines = doc.splitTextToSize(est.budget_notes, CONTENT_W);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...SLATE_600);
      doc.text(bnLines, MARGIN, y);
      y += bnLines.length * 4 + 4;
    }
  }

  // ── Vendors & Compliance ───────────────────────────────────────────────────

  addPage();
  sectionHeader('9. Recommended Vendors');

  if ((rec.recommended_vendors ?? []).length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Vendor', 'Specialty', 'Region', 'Website / Contact']],
      body: rec.recommended_vendors.map((v) => [v.vendor, v.specialty, v.region, v.website_hint ?? '—']),
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30 },
        3: { cellWidth: 38 },
      },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  checkY(20);
  sectionHeader('10. Compliance Standards', [5, 150, 105]);

  if ((rec.compliance_standards ?? []).length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Standard', 'Description']],
      body: rec.compliance_standards.map((s) => [s.standard, s.description]),
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 133 } },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Engineering Notes ─────────────────────────────────────────────────────

  if (rec.engineering_notes) {
    checkY(20);
    sectionHeader('11. Engineering Notes');
    const enLines = doc.splitTextToSize(rec.engineering_notes, CONTENT_W);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_900);
    doc.text(enLines, MARGIN, y);
    y += enLines.length * 4.5 + 6;
  }

  // ── Page numbers ──────────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_600);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, 292, { align: 'right' });
    doc.text('Generated by Flowid.ai — Confidential', MARGIN, 292);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const safeName = project.projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
  doc.save(`${safeName}_FluidSystem_Report.pdf`);
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export async function exportToExcel(project: Project): Promise<void> {
  const { utils, writeFile } = await import('xlsx');

  const rec = project.recommendation!;
  const est = rec.cost_estimate;
  const wb = utils.book_new();

  // ── Sheet 1: Bill of Materials ────────────────────────────────────────────

  const bomHeaders = [
    'ID', 'Component Name', 'Category', 'Quantity',
    'Specification', 'Material', 'Supplier', 'Model',
    'Unit Cost (MYR)', 'Total Cost (MYR)',
    'Confidence %', 'Lifespan (yr)', 'Lifespan Notes', 'Notes',
  ];

  const bomRows = (rec.components ?? []).map((c) => [
    c.id,
    c.name,
    c.category,
    c.quantity,
    c.specification,
    c.material,
    c.supplier,
    c.model,
    c.unit_cost_myr ?? c.unit_cost_usd ?? 0,
    c.total_cost_myr ?? c.total_cost_usd ?? 0,
    c.confidence_level ?? '',
    c.lifespan_years ?? '',
    c.lifespan_notes ?? '',
    c.notes ?? '',
  ]);

  // Totals row
  const bomTotal = (rec.components ?? []).reduce((s, c) => s + (c.total_cost_myr ?? c.total_cost_usd ?? 0), 0);
  bomRows.push(['', 'TOTAL', '', '', '', '', '', '', '', bomTotal, '', '', '', '']);

  const bomWs = utils.aoa_to_sheet([bomHeaders, ...bomRows]);
  bomWs['!cols'] = [
    { wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 8 },
    { wch: 40 }, { wch: 18 }, { wch: 22 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 13 }, { wch: 12 }, { wch: 40 }, { wch: 40 },
  ];
  utils.book_append_sheet(wb, bomWs, 'Bill of Materials');

  // ── Sheet 2: Alternatives ─────────────────────────────────────────────────

  const altHeaders = [
    'Ref Component ID', 'Primary Component', 'Alternative Name',
    'Alt Supplier', 'Alt Model', 'Alt Unit Cost (MYR)', 'Alt Total Cost (MYR)',
    'Alt Confidence %', 'Reason / Notes',
  ];

  const altRows: unknown[][] = [];
  for (const c of rec.components ?? []) {
    for (const alt of c.alternatives ?? []) {
      altRows.push([
        c.id, c.name, alt.name,
        alt.supplier, alt.model,
        alt.unit_cost_myr ?? 0,
        alt.total_cost_myr ?? 0,
        alt.confidence_level ?? '',
        alt.reason,
      ]);
    }
  }

  const altWs = utils.aoa_to_sheet([altHeaders, ...altRows]);
  altWs['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 30 },
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 50 },
  ];
  utils.book_append_sheet(wb, altWs, 'Alternatives');

  // ── Sheet 3: Cost Summary ─────────────────────────────────────────────────

  const equip = est?.equipment_cost_myr ?? est?.equipment_cost_usd ?? 0;
  const transport = est?.transportation_cost_myr ?? 0;
  const install = est?.installation_cost_myr ?? est?.installation_cost_usd ?? 0;
  const eng = est?.engineering_cost_myr ?? est?.engineering_cost_usd ?? 0;
  const comm = est?.commissioning_cost_myr ?? est?.commissioning_cost_usd ?? 0;
  const totalCost = est?.total_cost_myr ?? est?.total_cost_usd ?? 0;

  const costData = [
    ['FLOWID.AI — COST ESTIMATE SUMMARY', ''],
    ['', ''],
    ['Project', project.projectName],
    ['Date', formatDate(new Date())],
    ['Industry', project.input.industry],
    ['Location', `${cap(project.input.malaysiaState)}, Malaysia`],
    ['', ''],
    ['Cost Item', 'Amount (MYR)', '% of Total'],
    ['Equipment', equip, totalCost > 0 ? equip / totalCost : ''],
    ['Transportation & Logistics', transport, totalCost > 0 && transport > 0 ? transport / totalCost : ''],
    ['Installation', install, totalCost > 0 ? install / totalCost : ''],
    ['Engineering', eng, totalCost > 0 ? eng / totalCost : ''],
    ['Commissioning & Start-up', comm, totalCost > 0 ? comm / totalCost : ''],
    ['TOTAL PROJECT COST', totalCost, 1],
    ['', ''],
    ['Project Budget', project.input.budget, ''],
    ['Budget Utilisation', totalCost > 0 && project.input.budget > 0 ? totalCost / project.input.budget : '', ''],
    ['Within Budget?', (est?.within_budget !== false) ? 'YES' : 'NO', ''],
    ['', ''],
    ['AI Confidence', rec.overall_confidence !== undefined ? rec.overall_confidence / 100 : '', ''],
    ['Budget Notes', est?.budget_notes ?? '', ''],
  ];

  const costWs = utils.aoa_to_sheet(costData);
  costWs['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }];

  // Format percentage cells
  const pctCellRefs = ['C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'B17', 'B20'];
  for (const ref of pctCellRefs) {
    if (costWs[ref]) costWs[ref].z = '0.0%';
  }
  // Format currency cells
  const currCells = ['B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B16'];
  for (const ref of currCells) {
    if (costWs[ref]) costWs[ref].z = '#,##0';
  }

  utils.book_append_sheet(wb, costWs, 'Cost Summary');

  // ── Sheet 4: Instrumentation ──────────────────────────────────────────────

  const instHeaders = ['Tag', 'Description', 'Type', 'Service', 'Range', 'Material', 'Supplier', 'Unit Cost (MYR)'];
  const instRows = (rec.instrumentation ?? []).map((i) => [
    i.tag, i.description, i.type, i.service, i.range, i.material, i.supplier,
    i.unit_cost_myr ?? i.unit_cost_usd ?? 0,
  ]);

  const instWs = utils.aoa_to_sheet([instHeaders, ...instRows]);
  instWs['!cols'] = [
    { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 28 },
    { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
  ];
  utils.book_append_sheet(wb, instWs, 'Instrumentation');

  // ── Sheet 5: Risk Register ────────────────────────────────────────────────

  const riskHeaders = [
    'ID', 'Category', 'Hazard', 'Cause', 'Consequence',
    'Likelihood', 'Severity', 'Risk Level', 'Safeguard', 'Mitigation',
  ];
  const riskRows = (rec.risk_assessment?.risks ?? []).map((r) => [
    r.id, r.category, r.hazard, r.cause, r.consequence,
    r.likelihood, r.severity, r.risk_level, r.safeguard ?? '', r.mitigation,
  ]);

  const riskWs = utils.aoa_to_sheet([riskHeaders, ...riskRows]);
  riskWs['!cols'] = [
    { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 40 },
  ];
  utils.book_append_sheet(wb, riskWs, 'Risk Register');

  // ── Sheet 6: Maintenance ──────────────────────────────────────────────────

  const maintHeaders = ['Frequency', 'Task', 'Procedure', 'Duration (hr)', 'Requires Shutdown?'];
  const maintRows: unknown[][] = [];
  const maintOrder = ['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'];
  const sortedMaint = [...(rec.maintenance_schedule ?? [])].sort(
    (a, b) => maintOrder.indexOf(a.frequency) - maintOrder.indexOf(b.frequency)
  );
  for (const entry of sortedMaint) {
    for (const task of entry.tasks ?? []) {
      maintRows.push([
        cap(entry.frequency),
        task.task,
        task.procedure ?? '',
        task.estimated_duration_hours,
        task.requires_shutdown ? 'Yes' : 'No',
      ]);
    }
  }

  const maintWs = utils.aoa_to_sheet([maintHeaders, ...maintRows]);
  maintWs['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 60 }, { wch: 14 }, { wch: 18 }];
  utils.book_append_sheet(wb, maintWs, 'Maintenance Schedule');

  // ── Sheet 7: Project Summary ───────────────────────────────────────────────

  const summaryData = [
    ['FLOWID.AI — PROJECT SUMMARY', ''],
    ['', ''],
    ['Project Name', project.projectName],
    ['Created', formatDate(project.createdAt)],
    ['Industry', project.input.industry],
    ['Fluid Type', project.input.fluidType === 'chemical' || project.input.fluidType === 'other' ? project.input.customFluidType : cap(project.input.fluidType)],
    ['Application', project.input.application],
    ['Location', `${cap(project.input.malaysiaState)}, Malaysia`],
    ['Site Environment', cap(project.input.siteEnvironment)],
    ['Budget (MYR)', project.input.budget],
    ...(project.input.scaleFlowRateValue ? [['Flow Rate', `${project.input.scaleFlowRateValue} ${project.input.scaleFlowRateUnit ?? ''}`]] : []),
    ...(project.input.scaleVolumeMonthlyValue ? [['Monthly Volume', `${project.input.scaleVolumeMonthlyValue} ${project.input.scaleVolumeMonthlyUnit ?? ''}`]] : []),
    ['Special Requirements', project.input.specialRequirements ?? '—'],
    ['', ''],
    ['System Type', rec.system_type],
    ['Lead Time', `${rec.lead_time_weeks} weeks`],
    ['Overall Risk', cap(rec.risk_assessment?.overall_risk_level)],
    ['AI Confidence', rec.overall_confidence !== undefined ? `${rec.overall_confidence}%` : '—'],
    ['Total Components', (rec.components ?? []).length],
    ['Total Instruments', (rec.instrumentation ?? []).length],
    ['', ''],
    ['Summary', rec.summary],
    ['Engineering Notes', rec.engineering_notes ?? ''],
  ];

  const summaryWs = utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 24 }, { wch: 60 }];
  utils.book_append_sheet(wb, summaryWs, 'Project Summary');

  // ── Save ──────────────────────────────────────────────────────────────────

  const safeName = project.projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
  writeFile(wb, `${safeName}_FluidSystem_BOM.xlsx`);
}
