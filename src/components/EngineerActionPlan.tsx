'use client';

import { ClipboardCheck, ArrowRight, AlertTriangle, FileCheck, Stamp, ShoppingCart } from 'lucide-react';
import type { ValidationWarning, SystemComponent, Risk } from '@/types';

/**
 * "What to Revise & How to Use" — engineer's action plan for the project.
 * Dynamically generated from:
 *   - Validation warnings (must-fix items)
 *   - Low-confidence components (must-verify items)
 *   - High/critical risks (must-mitigate items)
 *   - Generic PE workflow (always shown)
 */

interface EngineerActionPlanProps {
  warnings: ValidationWarning[];
  components: SystemComponent[];
  risks: Risk[];
  systemType: string;
}

interface ReviseItem {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

const SEVERITY_STYLES: Record<ReviseItem['severity'], { bg: string; border: string; text: string; dot: string }> = {
  high:   { bg: 'bg-red-500/5',    border: 'border-red-500/30',    text: 'text-red-300',    dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-500/5',  border: 'border-amber-500/30',  text: 'text-amber-300',  dot: 'bg-amber-500' },
  low:    { bg: 'bg-blue-500/5',   border: 'border-blue-500/30',   text: 'text-blue-300',   dot: 'bg-blue-500' },
};

const HOW_TO_USE_STEPS = [
  {
    icon: FileCheck,
    title: 'Review the output',
    detail:
      'Open the BOM, P&ID, and cost breakdown. Cross-check the validation notes above. Confirm the process parameters match your actual system requirements.',
  },
  {
    icon: ShoppingCart,
    title: 'Get supplier quotations',
    detail:
      'Use the BOM as your RFQ basis. Send component specifications to the listed Malaysian suppliers (or your preferred alternatives) for firm quotes — the prices here are AACE Class 4–5 estimates, not final quotes.',
  },
  {
    icon: ClipboardCheck,
    title: 'Validate engineering decisions',
    detail:
      'Verify NPSH calculations against the pump curve from the actual OEM. Confirm pipe sizing using your hydraulic software. Cross-check HAZOP entries against your site-specific deviations.',
  },
  {
    icon: Stamp,
    title: 'PE stamp & submit',
    detail:
      'A licensed Professional Engineer must review, modify as needed, and stamp the final design before procurement, fabrication, or installation. Submit certified design for DOSH / BOMBA / SIRIM approval where applicable.',
  },
];

export default function EngineerActionPlan({
  warnings,
  components,
  risks,
  systemType,
}: EngineerActionPlanProps) {
  // ── Build the "What to revise" list dynamically ──────────────────────────

  const reviseItems: ReviseItem[] = [];

  // 1. Validation warnings (high severity)
  for (const w of warnings) {
    if (w.severity === 'warning') {
      reviseItems.push({
        severity: 'high',
        title: w.code === 'MATERIAL_INCOMPATIBLE' ? 'Material incompatibility flagged'
          : w.code === 'NPSH_MARGIN_LOW' ? 'NPSH margin below standard'
          : w.code === 'MOTOR_UNDERSIZED' ? 'Motor undersized'
          : w.code === 'COST_MISMATCH' ? 'Cost inconsistency'
          : w.code === 'ENG_MATH_DRIFT' ? 'Engineering calculation drift'
          : 'System flagged item',
        detail: w.message,
      });
    } else if (w.severity === 'info' && w.code !== 'ENG_MATH_VERIFIED') {
      reviseItems.push({
        severity: 'low',
        title: w.code === 'SUPPLIER_NOT_MY' ? 'Verify supplier locations'
          : w.code === 'HAZOP_GUIDEWORDS_MISSING' ? 'HAZOP coverage gaps'
          : w.code === 'BOM_PID_PUMP_MISMATCH' ? 'BOM ↔ P&ID inconsistency'
          : w.code === 'PID_TOO_SMALL' ? 'P&ID diagram too sparse'
          : w.code === 'PID_ORPHAN_NODES' ? 'Disconnected P&ID nodes'
          : w.code === 'COST_OUTLIER' ? 'Cost outlier — verify pricing'
          : w.code === 'FLOW_REGIME_MISMATCH' ? 'Flow regime label corrected'
          : 'Note to verify',
        detail: w.message,
      });
    }
  }

  // 2. Low-confidence components (medium severity)
  const lowConfidenceComponents = components.filter(
    (c) => typeof c.confidence_level === 'number' && c.confidence_level < 75,
  );
  if (lowConfidenceComponents.length > 0) {
    reviseItems.push({
      severity: 'medium',
      title: `${lowConfidenceComponents.length} component(s) with confidence < 75%`,
      detail: `Verify these against OEM catalogues before specifying: ${lowConfidenceComponents.slice(0, 3).map((c) => c.name).join(', ')}${lowConfidenceComponents.length > 3 ? `, +${lowConfidenceComponents.length - 3} more` : ''}.`,
    });
  }

  // 3. High & critical risks (medium severity)
  const seriousRisks = risks.filter(
    (r) => r.risk_level === 'high' || r.risk_level === 'critical',
  );
  if (seriousRisks.length > 0) {
    reviseItems.push({
      severity: 'medium',
      title: `${seriousRisks.length} high/critical risk(s) in HAZOP register`,
      detail: `Develop site-specific mitigation procedures for: ${seriousRisks.slice(0, 2).map((r) => r.hazard.substring(0, 50)).join('; ')}${seriousRisks.length > 2 ? '...' : ''}. PE must approve safeguards before commissioning.`,
    });
  }

  // 4. Always-present items
  reviseItems.push({
    severity: 'low',
    title: 'Confirm process parameters with site survey',
    detail:
      'AI-derived flow rate, pressure, and temperature were estimated from the application description. Validate against actual measured site conditions before final design.',
  });

  reviseItems.push({
    severity: 'low',
    title: 'Cross-check pricing with live quotations',
    detail:
      'All MYR prices are AACE Class 4–5 estimates (±30–50% accuracy). Request firm quotations from listed suppliers before procurement decisions.',
  });

  // Sort: high → medium → low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  reviseItems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="space-y-4">
      {/* What to revise */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">What to Revise Before Procurement</h3>
            <p className="text-xs text-slate-400">
              Engineer&apos;s checklist — auto-generated from validation results, confidence scores, and risk register.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {reviseItems.map((item, idx) => {
            const s = SEVERITY_STYLES[item.severity];
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 rounded-xl border p-3 ${s.border} ${s.bg}`}
              >
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.text}`}>{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            High — must address
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Medium — verify
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Low — confirm
          </span>
        </div>
      </div>

      {/* How to use */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">How to Use This Report</h3>
            <p className="text-xs text-slate-400">
              The intended workflow from AI-generated draft to certified design for {systemType.toLowerCase()}.
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          {HOW_TO_USE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <li key={idx} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">Step {idx + 1}</span>
                    <p className="text-sm font-medium text-white">{step.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-xs text-blue-200/80">
            <span className="font-medium text-blue-300">Flowid.ai is a feasibility tool, not a stamped design.</span>
            {' '}A licensed Professional Engineer (PE) must remain in the loop. This report compresses the
            documentation work — the engineering judgement still belongs to the PE.
          </p>
        </div>
      </div>
    </div>
  );
}
