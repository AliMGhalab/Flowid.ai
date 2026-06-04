'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createProject, computeInputHash, findCachedProject } from '@/lib/firestore';
import type { ProjectInput } from '@/types';
import { Droplets, Loader2, ChevronDown, AlertCircle, Zap, MapPin, Scale, FileText, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Options ──────────────────────────────────────────────────────────────────

const MALAYSIA_STATES = [
  { value: 'kuala_lumpur', label: 'Kuala Lumpur (W.P.)' },
  { value: 'selangor', label: 'Selangor' },
  { value: 'penang', label: 'Penang (Pulau Pinang)' },
  { value: 'johor', label: 'Johor' },
  { value: 'perak', label: 'Perak' },
  { value: 'negeri_sembilan', label: 'Negeri Sembilan' },
  { value: 'melaka', label: 'Melaka' },
  { value: 'pahang', label: 'Pahang' },
  { value: 'terengganu', label: 'Terengganu' },
  { value: 'kelantan', label: 'Kelantan' },
  { value: 'kedah', label: 'Kedah' },
  { value: 'perlis', label: 'Perlis' },
  { value: 'sabah', label: 'Sabah' },
  { value: 'sarawak', label: 'Sarawak' },
  { value: 'putrajaya', label: 'Putrajaya (W.P.)' },
  { value: 'labuan', label: 'Labuan (W.P.)' },
];

const SITE_ENVIRONMENTS = [
  { value: 'indoor_controlled', label: 'Indoor — Controlled Environment' },
  { value: 'indoor_industrial', label: 'Indoor — Industrial / Plant Room' },
  { value: 'outdoor_sheltered', label: 'Outdoor — Sheltered / Covered' },
  { value: 'outdoor_exposed', label: 'Outdoor — Exposed (Tropical)' },
  { value: 'offshore_marine', label: 'Offshore / Marine' },
  { value: 'hazardous_class1', label: 'Hazardous Area — Class I Div 1 (ATEX/IECEx)' },
  { value: 'underground', label: 'Underground / Basement' },
  { value: 'other', label: 'Other' },
];

// ─── Fluid groups (shown as optgroups in the select) ─────────────────────────
const FLUID_GROUPS = [
  {
    group: 'Water',
    fluids: [
      { value: 'water_utility',       label: 'Water — Utility / General' },
      { value: 'cooling_water',       label: 'Water — Cooling Tower / Condenser' },
      { value: 'demineralised_water', label: 'Water — Demineralised' },
      { value: 'ultrapure_water',     label: 'Water — Ultrapure / Deionised (UPW)' },
      { value: 'purified_water',      label: 'Water — Purified (PW, Pharma)' },
      { value: 'wfi',                 label: 'Water — Water for Injection (WFI)' },
      { value: 'seawater',            label: 'Water — Seawater / Brackish' },
      { value: 'chilled_water',       label: 'Water — Chilled (HVAC)' },
    ],
  },
  {
    group: 'Steam',
    fluids: [
      { value: 'steam_lp', label: 'Steam — Low Pressure (< 10 bar)' },
      { value: 'steam_hp', label: 'Steam — High Pressure (≥ 10 bar)' },
    ],
  },
  {
    group: 'Hydrocarbons & Fuels',
    fluids: [
      { value: 'crude_oil',    label: 'Crude Oil' },
      { value: 'natural_gas',  label: 'Natural Gas / Process Gas' },
      { value: 'lng',          label: 'LNG (Liquefied Natural Gas)' },
      { value: 'fuel_oil',     label: 'Fuel Oil (Diesel / HFO)' },
      { value: 'hydraulic_oil',label: 'Hydraulic Oil' },
      { value: 'glycol',       label: 'Glycol Solution (MEG / DEG / TEG)' },
    ],
  },
  {
    group: 'Palm Oil & Derivatives',
    fluids: [
      { value: 'cpo', label: 'Crude Palm Oil (CPO)' },
      { value: 'pko', label: 'Palm Kernel Oil (PKO)' },
      { value: 'rbdpo', label: 'RBD Palm Oil / Olein / Stearin' },
      { value: 'palm_fatty_acid', label: 'Palm Fatty Acid Distillate (PFAD)' },
    ],
  },
  {
    group: 'Gases',
    fluids: [
      { value: 'compressed_air', label: 'Compressed Air' },
      { value: 'nitrogen',       label: 'Nitrogen (N₂ — Gas / Liquid)' },
      { value: 'co2',            label: 'CO₂ (Carbon Dioxide)' },
      { value: 'ammonia_gas',    label: 'Ammonia (NH₃ — Refrigerant)' },
    ],
  },
  {
    group: 'Rubber & Latex',
    fluids: [
      { value: 'latex',          label: 'Latex (Natural Rubber)' },
      { value: 'ammonia_latex',  label: 'Ammonia Solution (Latex Preservation)' },
      { value: 'formic_acid',    label: 'Formic / Acetic Acid (Coagulant)' },
    ],
  },
  {
    group: 'Refrigeration',
    fluids: [
      { value: 'refrigerant_hfc', label: 'Refrigerant — HFC (R134a, R410A, R22)' },
      { value: 'refrigerant_co2', label: 'Refrigerant — CO₂ (R744, Transcritical)' },
      { value: 'refrigerant_nh3', label: 'Refrigerant — Ammonia (R717, Industrial)' },
    ],
  },
  {
    group: 'Process Slurries & Solids-Laden',
    fluids: [
      { value: 'slurry',       label: 'Slurry / Abrasive Fluid' },
      { value: 'palm_effluent',label: 'Palm Oil Mill Effluent (POME)' },
      { value: 'wastewater',   label: 'Industrial Wastewater / Effluent' },
    ],
  },
  {
    group: 'Chemicals (specify below)',
    fluids: [
      { value: 'chemical_acid',    label: 'Chemical — Acid (HCl, H₂SO₄, HNO₃…)' },
      { value: 'chemical_alkali',  label: 'Chemical — Alkali / Caustic (NaOH, KOH…)' },
      { value: 'chemical_solvent', label: 'Chemical — Solvent (IPA, Acetone, Toluene…)' },
      { value: 'chemical_other',   label: 'Chemical — Other (specify below)' },
    ],
  },
  {
    group: 'Other',
    fluids: [
      { value: 'other', label: 'Other — Not listed (specify below)' },
    ],
  },
];

// Flat list for lookups
const ALL_FLUID_TYPES = FLUID_GROUPS.flatMap((g) => g.fluids);

// Values that require a custom specification field
const NEEDS_SPEC = new Set([
  'chemical_acid', 'chemical_alkali', 'chemical_solvent', 'chemical_other', 'other',
]);

// ─── Industries (Malaysia-focused, ordered by prominence) ────────────────────
const INDUSTRY_FLUIDS: Record<string, string[]> = {
  'Oil & Gas': [
    'crude_oil', 'natural_gas', 'lng', 'fuel_oil', 'hydraulic_oil',
    'glycol', 'cooling_water', 'water_utility', 'chemical_acid', 'chemical_alkali', 'other',
  ],
  'Palm Oil & Oleochemical': [
    'cpo', 'pko', 'rbdpo', 'palm_fatty_acid', 'steam_lp', 'steam_hp',
    'water_utility', 'chemical_alkali', 'chemical_acid', 'palm_effluent', 'other',
  ],
  'Petrochemical': [
    'natural_gas', 'fuel_oil', 'glycol', 'steam_hp', 'steam_lp',
    'cooling_water', 'chemical_acid', 'chemical_alkali', 'chemical_solvent',
    'nitrogen', 'compressed_air', 'other',
  ],
  'Semiconductor & Electronics': [
    'ultrapure_water', 'cooling_water', 'nitrogen', 'compressed_air',
    'chemical_acid', 'chemical_alkali', 'chemical_solvent', 'co2', 'other',
  ],
  'Food & Beverage': [
    'water_utility', 'steam_lp', 'chilled_water', 'co2', 'compressed_air',
    'refrigerant_hfc', 'refrigerant_nh3', 'chemical_alkali', 'chemical_acid', 'other',
  ],
  'Water & Wastewater Treatment': [
    'water_utility', 'seawater', 'wastewater', 'palm_effluent',
    'chemical_acid', 'chemical_alkali', 'slurry', 'compressed_air', 'other',
  ],
  'Power Generation': [
    'demineralised_water', 'steam_hp', 'steam_lp', 'cooling_water',
    'fuel_oil', 'natural_gas', 'lng', 'chemical_acid', 'chemical_alkali', 'other',
  ],
  'Pharmaceutical': [
    'purified_water', 'wfi', 'steam_lp', 'nitrogen', 'compressed_air',
    'chemical_solvent', 'chemical_acid', 'chemical_alkali', 'other',
  ],
  'Rubber & Latex': [
    'latex', 'ammonia_latex', 'formic_acid', 'steam_lp',
    'water_utility', 'ammonia_gas', 'chemical_acid', 'other',
  ],
  'Marine & Offshore': [
    'seawater', 'fuel_oil', 'hydraulic_oil', 'compressed_air',
    'water_utility', 'lng', 'natural_gas', 'chemical_other', 'other',
  ],
  'Chemical Manufacturing': [
    'chemical_acid', 'chemical_alkali', 'chemical_solvent', 'chemical_other',
    'steam_hp', 'steam_lp', 'cooling_water', 'nitrogen', 'compressed_air', 'other',
  ],
  'HVAC & Building Services': [
    'chilled_water', 'cooling_water', 'refrigerant_hfc', 'refrigerant_co2',
    'refrigerant_nh3', 'steam_lp', 'compressed_air', 'water_utility', 'other',
  ],
  'Mining': [
    'water_utility', 'slurry', 'hydraulic_oil', 'chemical_acid',
    'chemical_alkali', 'compressed_air', 'wastewater', 'other',
  ],
  'Other / General': ALL_FLUID_TYPES.map((f) => f.value),
};

const INDUSTRIES = Object.keys(INDUSTRY_FLUIDS);

const FLOW_RATE_UNITS: ProjectInput['scaleFlowRateUnit'][] = ['m³/hr', 'L/min', 'GPM'];
const VOLUME_MONTHLY_UNITS: ProjectInput['scaleVolumeMonthlyUnit'][] = ['m³/month', 'L/month', 'gallons/month'];

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
      <AlertCircle className="h-3 w-3" />
      {msg}
    </p>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-300">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-500 focus:bg-slate-800';

const selectCls =
  'w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-blue-500';

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(data: ProjectInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!data.projectName.trim()) e.projectName = 'Project name is required';
  if (!data.malaysiaState) e.malaysiaState = 'Please select your state in Malaysia';
  if (!data.application.trim()) e.application = 'Application description is required';
  if (data.budget <= 0) e.budget = 'Budget must be greater than 0';
  if (
    (data.fluidType === 'chemical' || data.fluidType === 'other') &&
    !data.customFluidType?.trim()
  )
    e.customFluidType = 'Please specify the fluid type';
  return e;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FORM: ProjectInput = {
  projectName: '',
  malaysiaState: '',
  siteEnvironment: 'indoor_industrial',
  fluidType: 'crude_oil',
  customFluidType: '',
  application: '',
  industry: 'Oil & Gas',
  budget: 50000,
  specialRequirements: '',
  scaleFlowRateValue: undefined,
  scaleFlowRateUnit: 'm³/hr',
  scaleVolumeMonthlyValue: undefined,
  scaleVolumeMonthlyUnit: 'm³/month',
};

export default function NewProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ProjectInput>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [agentStep, setAgentStep] = useState(0);
  // Agentic mode toggle — when ON, calls /api/generate-agent (dynamic tool calling)
  //                       when OFF, calls /api/generate (single-call chain — proven)
  const [useAgentMode, setUseAgentMode] = useState(false);
  const [agentAvail, setAgentAvail] = useState<'unknown' | 'checking' | 'available' | 'busy'>('unknown');

  async function checkAgentAvailability() {
    setAgentAvail('checking');
    try {
      const res = await fetch('/api/health-check');
      const data = await res.json();
      // Agent providers: chutes-deepseek, chutes-qwen32, mistral-medium, mistral (large)
      const agentProviders = ['chutes-deepseek', 'chutes-qwen32', 'mistral-medium', 'mistral'];
      const anyUp = data.results?.some(
        (r: { provider: string; status: string }) => agentProviders.includes(r.provider) && r.status === 'ok'
      );
      setAgentAvail(anyUp ? 'available' : 'busy');
    } catch {
      setAgentAvail('busy');
    }
  }

  // Restore the user's preference across sessions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('flowid:useAgentMode');
      if (saved === '1') setUseAgentMode(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('flowid:useAgentMode', useAgentMode ? '1' : '0'); } catch {}
  }, [useAgentMode]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Read prefill from /new-project/from-document — hands off via sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('prefill') !== '1') return;
      const raw = sessionStorage.getItem('flowid:prefill');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProjectInput>;
      setForm((prev) => ({ ...prev, ...parsed }));
      sessionStorage.removeItem('flowid:prefill');
      toast.success('Form pre-filled from your document. Review and adjust as needed.');
    } catch {
      // ignore malformed prefill
    }
  }, []);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // When industry changes, reset fluid to the first valid option for that industry
  const handleIndustryChange = (industry: string) => {
    set('industry', industry);
    const allowedFluids = INDUSTRY_FLUIDS[industry] ?? ALL_FLUID_TYPES.map((f) => f.value);
    if (!allowedFluids.includes(form.fluidType)) {
      set('fluidType', allowedFluids[0]);
    }
  };

  const allowedValues = new Set(INDUSTRY_FLUIDS[form.industry] ?? ALL_FLUID_TYPES.map((f) => f.value));

  const availableGroups = FLUID_GROUPS.map((g) => ({
    ...g,
    fluids: g.fluids.filter((f) => allowedValues.has(f.value)),
  })).filter((g) => g.fluids.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!user) return;

    setGenerating(true);
    setAgentStep(0);
    setStatusMsg('Planner Agent reviewing inputs…');

    const timers: ReturnType<typeof setTimeout>[] = [];
    try {
      // ── Cache lookup: if the user has generated an identical project in the last 24h,
      //    return the saved result instead of regenerating. Guarantees reproducibility.
      //
      //    EXCEPTION: when agent mode is ON, we always do a fresh agent run so that
      //    the engineer (and judges, during demo) can SEE the tool-calling pipeline
      //    execute in real time. Cache only applies to classic mode.
      const inputHash = await computeInputHash(form);
      if (!useAgentMode) {
        const cached = await findCachedProject(user.uid, inputHash);
        if (cached) {
          setAgentStep(6);
          setStatusMsg('Found identical project — returning cached result…');
          toast.success('Identical project found — returning cached result');
          // Small UX pause so the user can see "cache hit" feedback before redirect
          await new Promise((r) => setTimeout(r, 600));
          router.push(`/project/${cached.id}?from=cache`);
          return;
        }
      }

      // Sequenced progress messages — cosmetic timers, not real server events
      timers.push(setTimeout(() => { setAgentStep(1); setStatusMsg('Selecting Malaysian suppliers and sizing equipment…'); }, 6000));
      timers.push(setTimeout(() => { setAgentStep(2); setStatusMsg('Computing hydraulics — NPSH, head, Reynolds number…'); }, 14000));
      timers.push(setTimeout(() => { setAgentStep(3); setStatusMsg('Running HAZOP risk analysis…'); }, 22000));
      timers.push(setTimeout(() => { setAgentStep(4); setStatusMsg('Reconciling costs in MYR…'); }, 30000));
      timers.push(setTimeout(() => { setAgentStep(5); setStatusMsg('Finalising design — almost ready…'); }, 38000));

      // Primary endpoint depends on the agent toggle
      const primaryEndpoint = useAgentMode ? '/api/generate-agent' : '/api/generate';
      let res = await fetch(primaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // Auto-fallback: if the agent path fails with 5xx, retry on the classic chain
      if (!res.ok && useAgentMode && res.status >= 500) {
        const fallbackBody = await res.json().catch(() => null);
        const fallbackReason = fallbackBody?.diagnostic ?? fallbackBody?.error ?? `HTTP ${res.status}`;
        console.warn('[new-project] agent endpoint failed — falling back to classic /api/generate. Reason:', fallbackReason);
        setStatusMsg('Agent pipeline unavailable — falling back to classic generation…');
        toast('Agent providers busy — using classic generation instead.', { duration: 4000 });
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      timers.forEach((t) => clearTimeout(t));

      if (!res.ok) {
        // Vercel 504 timeouts return HTML, not JSON — catch that case explicitly
        let errorMsg = 'Generation failed';
        if (res.status === 504) {
          errorMsg = 'Generation took too long (60s timeout). Try again — the AI was likely overloaded.';
        } else if (res.status === 429) {
          errorMsg = 'AI rate limit reached. Wait 60 seconds and try again.';
        } else {
          const body = await res.json().catch(() => null);
          errorMsg = body?.error ?? `Generation failed (HTTP ${res.status}). Check Vercel logs for details.`;
        }
        throw new Error(errorMsg);
      }

      const respBody = await res.json();
      const recommendation = respBody.recommendation;
      // Log which endpoint won and how many components came back — visible in browser console
      const compCount = Array.isArray(recommendation?.components) ? recommendation.components.length : 0;
      console.log(`[new-project] response from ${res.url.endsWith('/api/generate-agent') ? 'AGENT' : 'CLASSIC'} — ${compCount} components`);
      if (recommendation?.agent_meta) {
        console.log('[new-project] agent_meta:', recommendation.agent_meta);
      }

      setAgentStep(6);
      setStatusMsg('Saving your project…');
      const projectId = await createProject(user.uid, form, recommendation, inputHash);

      toast.success('System design complete!');
      router.push(`/project/${projectId}`);
    } catch (err) {
      timers.forEach((t) => clearTimeout(t));
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setGenerating(false);
      setStatusMsg('');
      setAgentStep(0);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const needsCustomFluid = NEEDS_SPEC.has(form.fluidType);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">New Fluid System Project</h1>
          <p className="text-sm text-slate-400">
            Describe your system — AI determines all process parameters, sizes every component to your scale, selects Malaysian suppliers, and checks DOSH / BOMBA compliance.
          </p>
        </div>
      </div>

      {/* Document upload shortcut */}
      <Link
        href="/new-project/from-document"
        className="mb-8 flex items-center gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
          <FileText className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            Have a client RFQ, email, or technical spec?
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Upload a PDF or paste the text — Flowid.ai will extract the requirements and auto-fill this form.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-blue-400" />
      </Link>

      {/* Agentic mode toggle */}
      <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Agentic AI pipeline</span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-violet-300">
              BETA
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {useAgentMode
              ? 'ON — the LLM dynamically calls tools (hydraulics calc, supplier lookup, material check, HAZOP audit, AACE cost reconciler) and reasons about each step. Auto-falls-back to classic pipeline if the agent fails.'
              : 'OFF — uses the classic single-call pipeline with post-validation. Proven and fast. Switch ON to use the new tool-calling agent.'}
          </p>
          <button
            type="button"
            onClick={checkAgentAvailability}
            disabled={agentAvail === 'checking'}
            className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
          >
            {agentAvail === 'checking' ? (
              <><span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />Checking…</>
            ) : agentAvail === 'available' ? (
              <><span className="h-2 w-2 rounded-full bg-green-400" />Agent available now</>
            ) : agentAvail === 'busy' ? (
              <><span className="h-2 w-2 rounded-full bg-red-400" />Agents busy — classic will be used</>
            ) : (
              <><span className="h-2 w-2 rounded-full bg-slate-500" />Check agent availability</>
            )}
          </button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={useAgentMode}
          onClick={() => setUseAgentMode((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border border-slate-700 transition-colors ${
            useAgentMode ? 'bg-violet-600' : 'bg-slate-800'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              useAgentMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Generating overlay — multi-agent pipeline */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-slate-800 border-t-blue-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <div>
                <p className="text-base font-semibold text-white">Multi-Agent Pipeline Running</p>
                <p className="text-xs text-slate-400">{statusMsg}</p>
              </div>
            </div>

            {/* Agent steps */}
            <div className="space-y-2">
              {[
                { label: 'Planner Agent', detail: 'Determining process parameters and system type' },
                { label: 'BOM Agent', detail: 'Selecting components from Malaysian supplier directory' },
                { label: 'Hydraulics Agent', detail: 'Computing NPSH, head loss, Reynolds, motor sizing' },
                { label: 'HAZOP Agent', detail: 'Applying risk guidewords across system nodes' },
                { label: 'Cost Agent', detail: 'Rolling up MYR pricing with transportation logistics' },
                { label: 'Validation Layer', detail: 'Zod schema + cost/NPSH/supplier sanity checks' },
              ].map((step, idx) => {
                const status = idx < agentStep ? 'done' : idx === agentStep ? 'active' : 'pending';
                return (
                  <div
                    key={step.label}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                      status === 'done'
                        ? 'border-green-500/30 bg-green-500/5'
                        : status === 'active'
                        ? 'border-blue-500/40 bg-blue-500/10'
                        : 'border-slate-800 bg-slate-900/40'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        status === 'done'
                          ? 'bg-green-500 text-white'
                          : status === 'active'
                          ? 'animate-pulse bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {status === 'done' ? '✓' : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          status === 'done'
                            ? 'text-green-300'
                            : status === 'active'
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-xs ${
                          status === 'pending' ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              Typically 20–60 seconds · Persistent storage on Firestore
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Malaysia Location ── */}
        <section className="rounded-2xl border border-blue-600/30 bg-blue-600/5 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
            <MapPin className="h-4 w-4" />
            Location in Malaysia
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>State</Label>
              <SelectWrapper>
                <select
                  value={form.malaysiaState}
                  onChange={(e) => set('malaysiaState', e.target.value)}
                  className={`${selectCls} ${errors.malaysiaState ? 'border-red-500' : ''}`}
                >
                  <option value="">— Select state —</option>
                  {MALAYSIA_STATES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </SelectWrapper>
              <FieldError msg={errors.malaysiaState} />
            </div>

            <div>
              <Label required>Site Environment</Label>
              <SelectWrapper>
                <select
                  value={form.siteEnvironment}
                  onChange={(e) => set('siteEnvironment', e.target.value)}
                  className={selectCls}
                >
                  {SITE_ENVIRONMENTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>
          <p className="mt-3 text-xs text-blue-400/70">
            Suppliers, pricing, and transportation costs are calculated based on your state.
          </p>
        </section>

        {/* ── Section 2: Project Details ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>
            Project Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label required>Project Name</Label>
              <input
                type="text"
                value={form.projectName}
                onChange={(e) => set('projectName', e.target.value)}
                placeholder="e.g. Cooling Water System — Unit 3, Plant Kemaman"
                className={`${inputCls} ${errors.projectName ? 'border-red-500' : ''}`}
              />
              <FieldError msg={errors.projectName} />
            </div>

            <div>
              <Label required>Industry</Label>
              <SelectWrapper>
                <select
                  value={form.industry}
                  onChange={(e) => handleIndustryChange(e.target.value)}
                  className={selectCls}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div className="sm:col-span-2">
              <Label required>Application / Purpose</Label>
              <textarea
                value={form.application}
                onChange={(e) => set('application', e.target.value)}
                rows={3}
                placeholder="Describe what this system does — e.g. circulating cooling water through heat exchangers for a gas compressor package at an LNG receiving terminal"
                className={`${inputCls} resize-none ${errors.application ? 'border-red-500' : ''}`}
              />
              <FieldError msg={errors.application} />
            </div>
          </div>
        </section>

        {/* ── Section 3: Fluid Type ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">2</span>
            Fluid Type
          </h2>
          <p className="mb-5 text-xs text-slate-500">
            Showing fluids relevant to <span className="text-slate-300">{form.industry}</span>. Flow rate, pressure, and temperature are determined by AI.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>Fluid</Label>
              <SelectWrapper>
                <select
                  value={form.fluidType}
                  onChange={(e) => set('fluidType', e.target.value)}
                  className={selectCls}
                >
                  {availableGroups.map((g) => (
                    <optgroup key={g.group} label={`── ${g.group}`}>
                      {g.fluids.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            {needsCustomFluid && (
              <div>
                <Label required>Specify Fluid</Label>
                <input
                  type="text"
                  value={form.customFluidType}
                  onChange={(e) => set('customFluidType', e.target.value)}
                  placeholder="e.g. 30% HCl solution"
                  className={`${inputCls} ${errors.customFluidType ? 'border-red-500' : ''}`}
                />
                <FieldError msg={errors.customFluidType} />
              </div>
            )}
          </div>
        </section>

        {/* ── Section 4: System Scale ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">3</span>
            System Scale
          </h2>
          <p className="mb-5 text-xs text-slate-500">
            Provide one or both scale inputs. This ensures component quantities and sizes match your actual production requirements.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Flow Rate */}
            <div>
              <Label>Flow Rate</Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={form.scaleFlowRateValue ?? ''}
                  onChange={(e) => set('scaleFlowRateValue', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 50"
                  className={`${inputCls} flex-1`}
                />
                <SelectWrapper>
                  <select
                    value={form.scaleFlowRateUnit}
                    onChange={(e) => set('scaleFlowRateUnit', e.target.value as ProjectInput['scaleFlowRateUnit'])}
                    className="appearance-none rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-3 text-sm text-white outline-none focus:border-blue-500 pr-7"
                  >
                    {FLOW_RATE_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>
            </div>

            {/* Volume per Month */}
            <div>
              <Label>Volume per Month</Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={form.scaleVolumeMonthlyValue ?? ''}
                  onChange={(e) => set('scaleVolumeMonthlyValue', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 36000"
                  className={`${inputCls} flex-1`}
                />
                <SelectWrapper>
                  <select
                    value={form.scaleVolumeMonthlyUnit}
                    onChange={(e) => set('scaleVolumeMonthlyUnit', e.target.value as ProjectInput['scaleVolumeMonthlyUnit'])}
                    className="appearance-none rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-3 text-sm text-white outline-none focus:border-blue-500 pr-8"
                  >
                    {VOLUME_MONTHLY_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-800/50 p-3">
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <p className="text-xs text-slate-500">
              If left blank, the AI estimates scale from your application description. Providing values improves component sizing accuracy.
            </p>
          </div>
        </section>

        {/* ── Section 5: Budget & Requirements ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">4</span>
            Budget & Special Requirements
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>Budget (MYR)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">RM</span>
                <input
                  type="number"
                  value={form.budget}
                  min={1}
                  onChange={(e) => set('budget', Number(e.target.value))}
                  className={`${inputCls} pl-10 ${errors.budget ? 'border-red-500' : ''}`}
                />
              </div>
              <FieldError msg={errors.budget} />
            </div>

            <div className="sm:col-span-2">
              <Label>Special Requirements</Label>
              <textarea
                value={form.specialRequirements}
                onChange={(e) => set('specialRequirements', e.target.value)}
                rows={3}
                placeholder="e.g. DOSH-approved equipment, BOMBA-compliant fire suppression, SIRIM-certified, corrosion resistant for coastal environment, halal-certified for food processing…"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={generating}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <><Loader2 className="h-5 w-5 animate-spin" />Generating Design…</>
          ) : (
            <><Zap className="h-5 w-5" />Generate System Design</>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          All prices in Malaysian Ringgit (MYR) including transportation. Suppliers selected by proximity to your state.
        </p>
      </form>
    </div>
  );
}
