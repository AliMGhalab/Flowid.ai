'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getProject } from '@/lib/firestore';
import type { Project, SystemComponent, Instrument, Risk, MaintenanceSchedule, LivePriceResult, ComponentAlternative } from '@/types';
import { getFluidLabel } from '@/lib/fluidLabels';
import ProcessFlowDiagram from '@/components/ProcessFlowDiagram';
import ValidationNotes from '@/components/ValidationNotes';
import EngineerActionPlan from '@/components/EngineerActionPlan';
import type { ValidationWarning } from '@/types';
import {
  ArrowLeft,
  LayoutDashboard,
  Package,
  GitBranch,
  Workflow,
  ShieldAlert,
  Wrench,
  DollarSign,
  Building2,
  Clock,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shuffle,
  FileDown,
  Sheet,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return 'RM ' + new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(n ?? 0);
}

function ConfidenceBadge({ level }: { level?: number }) {
  if (level === undefined || level === null) return null;
  const color =
    level >= 80 ? 'bg-green-400/10 text-green-400 border-green-400/20' :
    level >= 60 ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' :
                  'bg-red-400/10 text-red-400 border-red-400/20';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {level}% confident
    </span>
  );
}

function LifespanBadge({ years, notes }: { years?: number; notes?: string }) {
  if (!years) return null;
  return (
    <span
      title={notes}
      className="inline-flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-xs font-medium text-blue-300 cursor-help"
    >
      <Clock className="h-3 w-3" />
      ~{years}yr lifespan
    </span>
  );
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_BADGE: Record<RiskLevel, string> = {
  low: 'bg-green-400/10 text-green-400 border-green-400/20',
  medium: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  high: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  critical: 'bg-red-400/10 text-red-400 border-red-400/20',
};

const RISK_ICON: Record<RiskLevel, React.ElementType> = {
  low: CheckCircle2,
  medium: Info,
  high: AlertTriangle,
  critical: XCircle,
};

const CATEGORY_BADGE: Record<string, string> = {
  pump: 'bg-blue-400/10 text-blue-400',
  valve: 'bg-green-400/10 text-green-400',
  filter: 'bg-yellow-400/10 text-yellow-400',
  vessel: 'bg-purple-400/10 text-purple-400',
  fitting: 'bg-slate-400/10 text-slate-400',
  electrical: 'bg-red-400/10 text-red-400',
  safety: 'bg-red-400/10 text-red-400',
  instrument: 'bg-cyan-400/10 text-cyan-400',
  other: 'bg-slate-400/10 text-slate-400',
};

function RiskBadge({ level }: { level: string }) {
  const l = (level ?? 'low') as RiskLevel;
  const Icon = RISK_ICON[l] ?? Info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${RISK_BADGE[l] ?? RISK_BADGE.low}`}>
      <Icon className="h-3 w-3" />
      {l}
    </span>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'flow', label: 'Process Flow', icon: Workflow },
  { id: 'components', label: 'Components', icon: Package },
  { id: 'piping', label: 'Piping & Instrumentation', icon: GitBranch },
  { id: 'risks', label: 'Risk Assessment', icon: ShieldAlert },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'costs', label: 'Cost Estimate', icon: DollarSign },
  { id: 'vendors', label: 'Vendors & Standards', icon: Building2 },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      {title && <h3 className="mb-4 font-semibold text-white">{title}</h3>}
      {children}
    </div>
  );
}

function OverviewTab({ project }: { project: Project }) {
  const rec = project.recommendation!;
  const warnings = (rec as { validation_warnings?: ValidationWarning[] }).validation_warnings ?? [];
  const isAgent = !!(rec as { agent_trace?: unknown }).agent_trace;
  return (
    <div className="space-y-4">
      {/* Pipeline badge — shows which generation mode produced this result */}
      <div className="flex items-center gap-2">
        {isAgent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Generated by Agent Pipeline
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Generated by Classic Pipeline
          </span>
        )}
      </div>
      {/* Server-side validation audit — visible proof the system self-checks */}
      <ValidationNotes warnings={warnings} />

      <SectionCard title="System Overview">
        <p className="mb-4 text-slate-300 leading-relaxed">{rec.summary}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-800/60 p-4">
            <p className="mb-1 text-xs text-slate-500">System Type</p>
            <p className="text-sm font-medium text-white">{rec.system_type}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-4">
            <p className="mb-1 text-xs text-slate-500">Lead Time</p>
            <p className="text-sm font-medium text-white flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              {rec.lead_time_weeks} weeks
            </p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-4">
            <p className="mb-1 text-xs text-slate-500">Overall Risk</p>
            <RiskBadge level={rec.risk_assessment?.overall_risk_level ?? 'low'} />
          </div>
          {rec.overall_confidence !== undefined && (
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="mb-2 text-xs text-slate-500">AI Confidence</p>
              <ConfidenceBadge level={rec.overall_confidence} />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Design Basis">
        <p className="text-slate-300 leading-relaxed">{rec.design_basis}</p>
      </SectionCard>

      <SectionCard title="Project Parameters">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Fluid', value: getFluidLabel(project.input.fluidType, project.input.customFluidType) },
            { label: 'Industry', value: project.input.industry },
            { label: 'Location', value: project.input.malaysiaState?.replace(/_/g, ' ') ?? '—' },
            { label: 'Site Environment', value: project.input.siteEnvironment?.replace(/_/g, ' ') ?? '—' },
            { label: 'Budget', value: formatCurrency(project.input.budget) },
            ...(project.input.scaleFlowRateValue ? [{ label: 'Flow Rate', value: `${project.input.scaleFlowRateValue} ${project.input.scaleFlowRateUnit}` }] : []),
            ...(project.input.scaleVolumeMonthlyValue ? [{ label: 'Monthly Volume', value: `${project.input.scaleVolumeMonthlyValue} ${project.input.scaleVolumeMonthlyUnit}` }] : []),
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-800/40 px-3 py-2.5">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-0.5 text-sm font-medium capitalize text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {rec.process_parameters && (
        <SectionCard title="AI-Determined Process Parameters">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Design Flow Rate', value: rec.process_parameters.design_flow_rate },
              { label: 'Operating Pressure', value: rec.process_parameters.operating_pressure },
              { label: 'Design Pressure', value: rec.process_parameters.design_pressure },
              { label: 'Operating Temperature', value: rec.process_parameters.operating_temperature },
              { label: 'Design Temperature', value: rec.process_parameters.design_temperature },
              { label: 'Fluid Velocity', value: rec.process_parameters.fluid_velocity },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-blue-600/10 px-3 py-2.5 border border-blue-600/20">
                <p className="text-xs text-blue-400/70">{item.label}</p>
                <p className="mt-0.5 text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
          {rec.process_parameters.basis && (
            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300">Engineering basis: </span>
              {rec.process_parameters.basis}
            </p>
          )}
        </SectionCard>
      )}

      {rec.engineering_calculations && Object.keys(rec.engineering_calculations).length > 0 && (
        <SectionCard title="Engineering Calculations">
          <p className="mb-4 text-xs text-slate-400 leading-relaxed">
            Hydraulic and process calculations derived from the design parameters. Methods: Darcy-Weisbach
            for pipe friction, Colebrook for friction factor, NPSH per API 610.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              rec.engineering_calculations.npsh_available_m !== undefined && {
                label: 'NPSH Available',
                value: `${rec.engineering_calculations.npsh_available_m} m`,
              },
              rec.engineering_calculations.npsh_required_m !== undefined && {
                label: 'NPSH Required',
                value: `${rec.engineering_calculations.npsh_required_m} m`,
              },
              rec.engineering_calculations.npsh_margin_m !== undefined && {
                label: 'NPSH Margin',
                value: `${rec.engineering_calculations.npsh_margin_m} m${
                  rec.engineering_calculations.npsh_margin_m > 0.6 ? ' ✓' : ' ⚠'
                }`,
              },
              rec.engineering_calculations.total_dynamic_head_m !== undefined && {
                label: 'Total Dynamic Head',
                value: `${rec.engineering_calculations.total_dynamic_head_m} m`,
              },
              rec.engineering_calculations.static_head_m !== undefined && {
                label: 'Static Head',
                value: `${rec.engineering_calculations.static_head_m} m`,
              },
              rec.engineering_calculations.friction_head_m !== undefined && {
                label: 'Friction Head',
                value: `${rec.engineering_calculations.friction_head_m} m`,
              },
              rec.engineering_calculations.pump_power_kw !== undefined && {
                label: 'Pump Shaft Power',
                value: `${rec.engineering_calculations.pump_power_kw} kW`,
              },
              rec.engineering_calculations.motor_size_kw !== undefined && {
                label: 'Motor Size (IEC)',
                value: `${rec.engineering_calculations.motor_size_kw} kW`,
              },
              rec.engineering_calculations.pipe_velocity_m_s !== undefined && {
                label: 'Pipe Velocity',
                value: `${rec.engineering_calculations.pipe_velocity_m_s} m/s`,
              },
              rec.engineering_calculations.reynolds_number !== undefined && {
                label: 'Reynolds Number',
                value: rec.engineering_calculations.reynolds_number.toLocaleString('en-US'),
              },
              rec.engineering_calculations.flow_regime && {
                label: 'Flow Regime',
                value:
                  rec.engineering_calculations.flow_regime.charAt(0).toUpperCase() +
                  rec.engineering_calculations.flow_regime.slice(1),
              },
              rec.engineering_calculations.friction_factor !== undefined && {
                label: 'Friction Factor (Darcy)',
                value: String(rec.engineering_calculations.friction_factor),
              },
              rec.engineering_calculations.pressure_drop_bar_per_100m !== undefined && {
                label: 'ΔP per 100 m',
                value: `${rec.engineering_calculations.pressure_drop_bar_per_100m} bar`,
              },
              rec.engineering_calculations.heat_load_kw !== undefined &&
                rec.engineering_calculations.heat_load_kw > 0 && {
                  label: 'Heat Load',
                  value: `${rec.engineering_calculations.heat_load_kw} kW`,
                },
            ]
              .filter((x): x is { label: string; value: string } => Boolean(x))
              .map((item, idx) => (
                <div key={idx} className="border-l-2 border-slate-700 pl-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
          </div>
          {rec.engineering_calculations.notes && (
            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300">Calculation basis: </span>
              {rec.engineering_calculations.notes}
            </p>
          )}
        </SectionCard>
      )}

      {rec.engineering_notes && (
        <SectionCard title="Engineering Notes">
          <p className="text-slate-300 leading-relaxed">{rec.engineering_notes}</p>
        </SectionCard>
      )}

      {/* Engineer's action plan — what to revise + how to use this report */}
      <EngineerActionPlan
        warnings={warnings}
        components={rec.components ?? []}
        risks={rec.risk_assessment?.risks ?? []}
        systemType={rec.system_type ?? 'fluid system'}
      />
    </div>
  );
}

function ComponentsTab({ components }: { components: SystemComponent[] }) {
  const [filter, setFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [livePrices, setLivePrices] = useState<Record<string, LivePriceResult>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  const categories = ['all', ...Array.from(new Set(components.map((c) => c.category)))];
  const filtered = filter === 'all' ? components : components.filter((c) => c.category === filter);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkLivePrices = useCallback(async () => {
    setPriceLoading(true);
    try {
      const payload = components.map((c) => ({
        id: c.id,
        name: c.name,
        model: c.model,
        supplier: c.supplier,
      }));
      const res = await fetch('/api/price-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: payload }),
      });
      if (!res.ok) throw new Error('Price check request failed');
      const data = await res.json();
      const map: Record<string, LivePriceResult> = {};
      for (const r of (data.results ?? []) as LivePriceResult[]) {
        map[r.componentId] = r;
      }
      setLivePrices(map);
      const found = Object.values(map).filter((r) => r.found).length;
      toast.success(`Found live prices for ${found} of ${components.length} components`);
    } catch {
      toast.error('Live price check unavailable right now. Try again later.');
    } finally {
      setPriceLoading(false);
    }
  }, [components]);

  return (
    <div className="space-y-4">
      {/* Top bar: filter + live price button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={checkLivePrices}
          disabled={priceLoading}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {priceLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : Object.keys(livePrices).length > 0 ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {priceLoading
            ? 'Searching suppliers…'
            : Object.keys(livePrices).length > 0
            ? 'Refresh Live Prices'
            : 'Check Live Prices'}
        </button>
      </div>

      {/* Hint */}
      {!priceLoading && Object.keys(livePrices).length === 0 && (
        <p className="text-xs text-slate-500">
          Click &ldquo;Check Live Prices&rdquo; to query Malaysian supplier websites for current pricing.
        </p>
      )}

      {/* Component cards */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const cost = c.total_cost_myr ?? c.total_cost_usd ?? 0;
          const unitCost = c.unit_cost_myr ?? c.unit_cost_usd ?? 0;
          const live = livePrices[c.id];
          const isExpanded = expandedIds.has(c.id);
          const hasAlts = (c.alternatives?.length ?? 0) > 0;

          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
            >
              {/* Main component row */}
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                {/* Left: ID + name + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                      {c.id}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${CATEGORY_BADGE[c.category] ?? CATEGORY_BADGE.other}`}>
                      {c.category}
                    </span>
                    <ConfidenceBadge level={c.confidence_level} />
                    <LifespanBadge years={c.lifespan_years} notes={c.lifespan_notes} />
                    {/* Live price badge */}
                    {live?.found && (
                      <a
                        href={live.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {live.price_text} · {live.source_name}
                      </a>
                    )}
                    {live && !live.found && (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                        No online price found
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-white">{c.name}</h4>
                  <p className="mt-0.5 text-xs text-slate-400">{c.supplier} · {c.model}</p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.specification}</p>
                  {c.notes && (
                    <p className="mt-1 text-xs text-slate-600 italic line-clamp-1">{c.notes}</p>
                  )}
                </div>

                {/* Right: qty + costs + expand toggle */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Qty: {c.quantity}</p>
                    <p className="text-xs text-slate-500">Unit: {formatCurrency(unitCost)}</p>
                    <p className="font-bold text-green-400">{formatCurrency(cost)}</p>
                  </div>
                  {hasAlts && (
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                    >
                      <Shuffle className="h-3.5 w-3.5 text-amber-400" />
                      {c.alternatives!.length} alternative{c.alternatives!.length !== 1 ? 's' : ''}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Price basis (inside expanded view) */}
              {isExpanded && c.price_basis && (
                <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-2">
                  <p className="text-xs text-slate-400">
                    <span className="font-medium text-slate-300">Price basis: </span>
                    <span className="italic">{c.price_basis}</span>
                  </p>
                </div>
              )}

              {/* Alternatives panel */}
              {hasAlts && isExpanded && (
                <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Alternative Options
                  </p>
                  <div className="space-y-2">
                    {c.alternatives!.map((alt: ComponentAlternative, i: number) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 sm:flex-row sm:items-start sm:gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">{alt.name}</p>
                          <p className="text-xs text-slate-400">{alt.supplier} · {alt.model}</p>
                          <p className="mt-1 text-xs text-amber-300/70 italic">{alt.reason}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-500">Unit: {formatCurrency(alt.unit_cost_myr)}</p>
                          <p className="font-semibold text-amber-400">{formatCurrency(alt.total_cost_myr)}</p>
                          {cost > 0 && alt.total_cost_myr > 0 && (
                            <p className={`text-xs ${alt.total_cost_myr < cost ? 'text-green-400' : 'text-red-400'}`}>
                              {alt.total_cost_myr < cost
                                ? `Save ${formatCurrency(cost - alt.total_cost_myr)}`
                                : `+${formatCurrency(alt.total_cost_myr - cost)}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Subtotal */}
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
        <span className="text-sm font-semibold text-white">
          Equipment Subtotal ({filtered.length} items)
        </span>
        <span className="font-bold text-green-400">
          {formatCurrency(filtered.reduce((sum, c) => sum + (c.total_cost_myr ?? c.total_cost_usd ?? 0), 0))}
        </span>
      </div>
    </div>
  );
}

function PipingTab({ project }: { project: Project }) {
  const rec = project.recommendation!;
  const piping = rec.piping;
  const instruments = rec.instrumentation ?? [];
  const hasPipingData = piping && (piping.material || piping.nominal_diameter_inch);
  const hasInstruments = instruments.length > 0;

  if (!hasPipingData && !hasInstruments) {
    return (
      <SectionCard title="Piping & Instrumentation">
        <div className="py-8 text-center">
          <p className="mb-2 text-slate-300">No piping or instrumentation data in this project.</p>
          <p className="text-xs text-slate-500">
            The AI may have skipped these fields. Try regenerating the project, or check the BOM for piping items
            and instruments embedded as components.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {piping && (
        <SectionCard title="Piping Specification">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Material', value: piping.material },
              { label: 'Nominal Diameter', value: `${piping.nominal_diameter_inch}"` },
              { label: 'Schedule', value: `Sch. ${piping.schedule}` },
              { label: 'Connection Type', value: piping.connection_type },
              { label: 'Insulation', value: piping.insulation_required ? (piping.insulation_type ?? 'Yes') : 'Not required' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-800/60 p-4">
                <p className="mb-1 text-xs text-slate-500">{item.label}</p>
                <p className="text-sm font-medium capitalize text-white">{item.value}</p>
              </div>
            ))}
          </div>
          {piping.design_notes && (
            <p className="mt-4 text-sm text-slate-400">{piping.design_notes}</p>
          )}
        </SectionCard>
      )}

      {instruments.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-white">Instrumentation List</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  {['Tag', 'Description', 'Service', 'Range', 'Material', 'Supplier', 'Unit Cost'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {instruments.map((inst: Instrument) => (
                  <tr key={inst.tag} className="transition-colors hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-400">{inst.tag}</td>
                    <td className="px-4 py-3 text-white">{inst.description}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{inst.service}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{inst.range}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{inst.material}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{inst.supplier}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-400">
                      {formatCurrency((inst as Instrument & { unit_cost_myr?: number }).unit_cost_myr ?? inst.unit_cost_usd ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RisksTab({ project }: { project: Project }) {
  const ra = project.recommendation?.risk_assessment;
  if (!ra) return <p className="text-slate-400">No risk data available.</p>;

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">Overall Risk Level</p>
            <RiskBadge level={ra.overall_risk_level} />
          </div>
          {ra.hazop_summary && (
            <p className="text-sm text-slate-400 sm:max-w-md sm:text-right">{ra.hazop_summary}</p>
          )}
        </div>
      </SectionCard>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900">
              {['ID', 'Category', 'Hazard', 'Cause', 'Likelihood', 'Severity', 'Risk Level', 'Mitigation'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900">
            {(ra.risks ?? []).map((r: Risk) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-800/50">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.id}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs capitalize text-slate-300">
                    {r.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-white max-w-[160px]">
                  <p className="line-clamp-2">{r.hazard}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[140px]">
                  <p className="line-clamp-2">{r.cause}</p>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={r.likelihood} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={r.severity} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={r.risk_level} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">
                  <p className="line-clamp-3">{r.mitigation}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceTab({ schedule }: { schedule: MaintenanceSchedule[] }) {
  const order = ['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'];
  const sorted = [...(schedule ?? [])].sort(
    (a, b) => order.indexOf(a.frequency) - order.indexOf(b.frequency)
  );

  const FREQ_COLORS: Record<string, string> = {
    daily: 'bg-blue-400/10 text-blue-400',
    weekly: 'bg-cyan-400/10 text-cyan-400',
    monthly: 'bg-green-400/10 text-green-400',
    quarterly: 'bg-yellow-400/10 text-yellow-400',
    biannual: 'bg-orange-400/10 text-orange-400',
    annual: 'bg-red-400/10 text-red-400',
  };

  return (
    <div className="space-y-4">
      {sorted.map((entry) => (
        <SectionCard key={entry.frequency}>
          <div className="mb-4 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${FREQ_COLORS[entry.frequency] ?? 'bg-slate-400/10 text-slate-400'}`}>
              {entry.frequency}
            </span>
            <span className="text-sm text-slate-400">
              {entry.tasks?.length ?? 0} task{(entry.tasks?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {(entry.tasks ?? []).map((task, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium text-white">{task.task}</h4>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">
                      {task.estimated_duration_hours}h
                    </span>
                    {task.requires_shutdown && (
                      <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-xs text-red-400">
                        Shutdown required
                      </span>
                    )}
                  </div>
                </div>
                {task.procedure && (
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{task.procedure}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

type MyrCostEst = {
  equipment_cost_myr?: number; equipment_cost_usd?: number;
  transportation_cost_myr?: number;
  installation_cost_myr?: number; installation_cost_usd?: number;
  engineering_cost_myr?: number; engineering_cost_usd?: number;
  commissioning_cost_myr?: number; commissioning_cost_usd?: number;
  total_cost_myr?: number; total_cost_usd?: number;
  within_budget?: boolean; budget_notes?: string;
  cost_basis?: string;
  equipment_basis?: string;
  transportation_basis?: string;
  installation_basis?: string;
  engineering_basis?: string;
  commissioning_basis?: string;
};

function CostsTab({ project }: { project: Project }) {
  const est = project.recommendation?.cost_estimate as MyrCostEst | undefined;
  if (!est) return <p className="text-slate-400">No cost data available.</p>;

  const equip = est.equipment_cost_myr ?? est.equipment_cost_usd ?? 0;
  const transport = est.transportation_cost_myr ?? 0;
  const install = est.installation_cost_myr ?? est.installation_cost_usd ?? 0;
  const eng = est.engineering_cost_myr ?? est.engineering_cost_usd ?? 0;
  const comm = est.commissioning_cost_myr ?? est.commissioning_cost_usd ?? 0;
  const total = est.total_cost_myr ?? est.total_cost_usd ?? 0;

  const rows = [
    { label: 'Equipment', value: equip, color: 'bg-blue-500', basis: est.equipment_basis },
    { label: 'Transportation & Logistics', value: transport, color: 'bg-orange-500', basis: est.transportation_basis },
    { label: 'Installation', value: install, color: 'bg-purple-500', basis: est.installation_basis },
    { label: 'Engineering', value: eng, color: 'bg-cyan-500', basis: est.engineering_basis },
    { label: 'Commissioning & Start-up', value: comm, color: 'bg-green-500', basis: est.commissioning_basis },
  ].filter((r) => r.value > 0);

  const budgetUsed = total > 0 ? (total / project.input.budget) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard>
          <p className="mb-1 text-xs text-slate-500">Total Estimate</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(total)}</p>
        </SectionCard>
        <SectionCard>
          <p className="mb-1 text-xs text-slate-500">Project Budget</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(project.input.budget)}</p>
        </SectionCard>
        <SectionCard>
          <p className="mb-1 text-xs text-slate-500">Budget Status</p>
          <div className="flex items-center gap-2">
            {est.within_budget !== false ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <span className={`font-semibold ${est.within_budget !== false ? 'text-green-400' : 'text-red-400'}`}>
              {est.within_budget !== false ? 'Within Budget' : 'Exceeds Budget'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{Math.round(budgetUsed)}% of budget used</p>
        </SectionCard>
      </div>

      <SectionCard title="Cost Breakdown">
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs leading-relaxed text-slate-400">
            <span className="font-medium text-slate-300">Estimating methodology: </span>
            Class 4–5 feasibility estimate per AACE International cost classification (typical accuracy ±30–50%).
            Equipment cost is the verified sum of BOM line items. Non-equipment lines use AACE / Lang-Method
            percentages of equipment cost, adjusted to Malaysian market conditions. For procurement-grade pricing,
            a licensed PE must validate via supplier quotations.
          </p>
        </div>
        <div className="space-y-4">
          {rows.map((row) => {
            const pct = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{row.label}</span>
                  <span className="font-medium text-white">{formatCurrency(row.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${row.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {row.basis && (
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {row.basis}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-slate-700 pt-3 text-sm font-bold">
            <span className="text-white">Total Project Cost</span>
            <span className="text-lg text-green-400">{formatCurrency(total)}</span>
          </div>
        </div>
        {est.budget_notes && (
          <p className="mt-4 text-sm text-slate-400">{est.budget_notes}</p>
        )}
        {est.cost_basis && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <p className="text-xs text-blue-200/80">
              <span className="font-medium text-blue-300">Cost basis: </span>
              {est.cost_basis}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function VendorsTab({ project }: { project: Project }) {
  const vendors = project.recommendation?.recommended_vendors ?? [];
  const standards = project.recommendation?.compliance_standards ?? [];

  return (
    <div className="space-y-4">
      {vendors.length > 0 && (
        <SectionCard title="Recommended Vendors">
          <div className="grid gap-3 sm:grid-cols-2">
            {vendors.map((v) => (
              <div key={v.vendor} className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-white">{v.vendor}</h4>
                  <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    {v.region}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{v.specialty}</p>
                {v.website_hint && (
                  <p className="mt-1.5 text-xs text-blue-400">{v.website_hint}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {standards.length > 0 && (
        <SectionCard title="Applicable Compliance Standards">
          <div className="space-y-2">
            {standards.map((s) => (
              <div key={s.standard} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                <div>
                  <span className="font-mono text-sm font-semibold text-white">{s.standard}</span>
                  <p className="text-xs text-slate-400">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // Detect ?from=cache flag set when we returned a cached project on the new-project flow.
  // Used to show a small "Reproduced from cache" badge.
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('from') === 'cache') setFromCache(true);
    } catch {}
  }, []);

  const [project, setProject] = useState<Project | null>(null);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingXLSX, setExportingXLSX] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !id) return;
    getProject(id)
      .then((p) => {
        if (!p) { toast.error('Project not found'); router.replace('/dashboard'); return; }
        if (p.userId !== user.uid) { router.replace('/dashboard'); return; }
        setProject(p);
      })
      .catch(() => { toast.error('Failed to load project'); router.replace('/dashboard'); })
      .finally(() => setFetching(false));
  }, [user, id, router]);

  if (authLoading || fetching || !project) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading project…</p>
        </div>
      </div>
    );
  }

  const rec = project.recommendation;
  if (!rec) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-slate-400">No recommendation data for this project.</p>
      </div>
    );
  }

  async function handleExportPDF() {
    if (!project) return;
    setExportingPDF(true);
    try {
      const { exportToPDF } = await import('@/lib/exportProject');
      await exportToPDF(project);
      toast.success('PDF report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('PDF export failed');
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleExportExcel() {
    if (!project) return;
    setExportingXLSX(true);
    try {
      const { exportToExcel } = await import('@/lib/exportProject');
      await exportToExcel(project);
      toast.success('Excel BOM downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Excel export failed');
    } finally {
      setExportingXLSX(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <Droplets className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white sm:text-2xl">{project.projectName}</h1>
                {fromCache && (
                  <span
                    title={`Identical inputs were generated earlier on ${project.createdAt.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} — returning the cached result for reproducibility.`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Reproduced from cache
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                {project.input.industry} · {getFluidLabel(project.input.fluidType, project.input.customFluidType)}
                {project.input.malaysiaState && ` · ${project.input.malaysiaState.replace(/_/g, ' ')}, Malaysia`}
              </p>
              <p className="mt-1 text-xs text-slate-500">{rec.system_type}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={rec.risk_assessment?.overall_risk_level ?? 'low'} />
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-green-400">
              {formatCurrency((rec.cost_estimate as typeof rec.cost_estimate & { total_cost_myr?: number })?.total_cost_myr ?? rec.cost_estimate?.total_cost_usd ?? 0)}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
              <Clock className="h-3 w-3" />
              {rec.lead_time_weeks}w lead time
            </span>

            {/* Export buttons */}
            <div className="flex items-center gap-2 ml-1">
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                title="Download PDF Engineering Report"
                className="flex items-center gap-1.5 rounded-xl border border-blue-600/40 bg-blue-600/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-600/20 hover:border-blue-500 disabled:opacity-60"
              >
                {exportingPDF ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                {exportingPDF ? 'Generating…' : 'Export PDF'}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportingXLSX}
                title="Download Excel BOM & Data"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-600/20 hover:border-emerald-500 disabled:opacity-60"
              >
                {exportingXLSX ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sheet className="h-3.5 w-3.5" />
                )}
                {exportingXLSX ? 'Generating…' : 'Export Excel'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'flow' && (
          rec.process_flow && rec.process_flow.nodes && rec.process_flow.nodes.length > 0 ? (
            <ProcessFlowDiagram flow={rec.process_flow} projectName={project.projectName} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 py-16 text-center">
              <Workflow className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-slate-300">No process flow data in this project.</p>
              <p className="mt-1 text-xs text-slate-500">
                Older projects don&apos;t include the P&amp;ID diagram. Regenerate this project to get one.
              </p>
            </div>
          )
        )}
        {activeTab === 'components' && <ComponentsTab components={rec.components ?? []} />}
        {activeTab === 'piping' && <PipingTab project={project} />}
        {activeTab === 'risks' && <RisksTab project={project} />}
        {activeTab === 'maintenance' && <MaintenanceTab schedule={rec.maintenance_schedule ?? []} />}
        {activeTab === 'costs' && <CostsTab project={project} />}
        {activeTab === 'vendors' && <VendorsTab project={project} />}
      </div>
    </div>
  );
}
