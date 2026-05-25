'use client';

import { useState } from 'react';
import { ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { ValidationWarning } from '@/types';

/**
 * Displays the server-side validation audit trail to the user.
 * Shows what was checked, what passed, what was flagged, and what was auto-corrected.
 * Builds trust by making the system's self-checking visible.
 */

const CODE_LABELS: Record<string, string> = {
  COST_MISMATCH:           'Cost integrity',
  NPSH_MARGIN_LOW:         'NPSH margin',
  SUPPLIER_NOT_MY:         'Supplier verification',
  PID_TOO_SMALL:           'P&ID coverage',
  PID_ORPHAN_NODES:        'P&ID connectivity',
  COST_OUTLIER:            'Cost outlier check',
  ENG_MATH_DRIFT:          'Engineering math',
  ENG_MATH_VERIFIED:       'Engineering math',
  FLOW_REGIME_MISMATCH:    'Flow regime',
  MOTOR_UNDERSIZED:        'Motor sizing',
  BOM_PID_PUMP_MISMATCH:   'BOM/P&ID consistency',
  HAZOP_GUIDEWORDS_MISSING: 'HAZOP coverage',
  MATERIAL_INCOMPATIBLE:   'Material compatibility',
};

const ALL_CHECKS = [
  { code: 'COST_MISMATCH',           label: 'Cost integrity (BOM sum vs declared total)' },
  { code: 'ENG_MATH_VERIFIED',       label: 'Engineering math (NPSH, TDH, Reynolds, motor sizing)' },
  { code: 'FLOW_REGIME_MISMATCH',    label: 'Flow regime label vs Reynolds number' },
  { code: 'MOTOR_UNDERSIZED',        label: 'Motor sized correctly vs pump shaft power (IEC 60034)' },
  { code: 'NPSH_MARGIN_LOW',         label: 'NPSH margin ≥ API 610 minimum of 0.6 m' },
  { code: 'BOM_PID_PUMP_MISMATCH',   label: 'BOM ↔ P&ID pump count consistency' },
  { code: 'HAZOP_GUIDEWORDS_MISSING', label: 'HAZOP covers required guidewords' },
  { code: 'MATERIAL_INCOMPATIBLE',   label: 'Material compatibility with declared fluid' },
  { code: 'SUPPLIER_NOT_MY',         label: 'Supplier names match Malaysian patterns' },
  { code: 'PID_TOO_SMALL',           label: 'P&ID has ≥6 nodes for useful diagram' },
  { code: 'PID_ORPHAN_NODES',        label: 'Every P&ID node is connected' },
  { code: 'COST_OUTLIER',            label: 'No single component is > 50% of total' },
];

interface ValidationNotesProps {
  warnings: ValidationWarning[];
}

export default function ValidationNotes({ warnings }: ValidationNotesProps) {
  const [expanded, setExpanded] = useState(false);

  // Group warnings by code so we can show "what passed" too
  const flaggedCodes = new Set(warnings.map((w) => w.code));

  // Severity counts
  const errCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  const totalChecks = ALL_CHECKS.length;
  const issuesFound = errCount + warnCount;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            issuesFound === 0 ? 'bg-green-500/10 text-green-400' : warnCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
          }`}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Server-Side Validation</h3>
            <p className="text-xs text-slate-400">
              {issuesFound === 0
                ? `All ${totalChecks} integrity checks passed`
                : `${warnCount > 0 ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}` : ''}${warnCount > 0 && infoCount > 0 ? ', ' : ''}${infoCount > 0 ? `${infoCount} info note${infoCount !== 1 ? 's' : ''}` : ''} across ${totalChecks} engineering & cost checks`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-800 p-4">
          {/* Flagged items first */}
          {warnings.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes from validation</p>
              <div className="space-y-2">
                {warnings.map((w, idx) => {
                  const Icon = w.severity === 'warning' ? AlertTriangle : Info;
                  const color = w.severity === 'warning' ? 'text-amber-400' : 'text-blue-400';
                  const bgClass = w.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-blue-500/20 bg-blue-500/5';
                  return (
                    <div key={idx} className={`flex items-start gap-2 rounded-xl border p-3 ${bgClass}`}>
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                      <div className="text-sm">
                        <p className={`font-medium ${color}`}>{CODE_LABELS[w.code] ?? w.code}</p>
                        <p className="mt-0.5 text-slate-300">{w.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All checks performed — passing ones get a green check */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">All checks performed</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ALL_CHECKS.map((check) => {
              const flagged = flaggedCodes.has(check.code);
              return (
                <div key={check.code} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 ${flagged ? 'text-amber-400' : 'text-green-400'}`}>
                    {flagged ? '⚠' : '✓'}
                  </span>
                  <span className="text-slate-400">{check.label}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            All checks run server-side after AI generation. Findings shown here do not appear in the PDF —
            engineer should review before procurement.
          </p>
        </div>
      )}
    </div>
  );
}
