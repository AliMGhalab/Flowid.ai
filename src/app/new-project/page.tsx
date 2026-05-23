'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createProject } from '@/lib/firestore';
import type { ProjectInput } from '@/types';
import { Droplets, Loader2, ChevronDown, AlertCircle, Zap, MapPin, Scale } from 'lucide-react';
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

const ALL_FLUID_TYPES = [
  { value: 'water', label: 'Water' },
  { value: 'steam', label: 'Steam' },
  { value: 'hydraulic_oil', label: 'Hydraulic Oil' },
  { value: 'compressed_air', label: 'Compressed Air' },
  { value: 'natural_gas', label: 'Natural Gas' },
  { value: 'fuel_oil', label: 'Fuel Oil' },
  { value: 'refrigerant', label: 'Refrigerant' },
  { value: 'slurry', label: 'Slurry / Abrasive Fluid' },
  { value: 'chemical', label: 'Chemical (specify below)' },
  { value: 'other', label: 'Other (specify below)' },
];

// Industry defines which fluids are relevant
const INDUSTRY_FLUIDS: Record<string, string[]> = {
  'Oil & Gas':        ['natural_gas', 'fuel_oil', 'hydraulic_oil', 'water', 'chemical', 'other'],
  'Chemical':         ['chemical', 'water', 'steam', 'hydraulic_oil', 'compressed_air', 'other'],
  'Food & Beverage':  ['water', 'steam', 'refrigerant', 'compressed_air', 'other'],
  'Pharmaceutical':   ['water', 'steam', 'chemical', 'compressed_air', 'other'],
  'Water Treatment':  ['water', 'chemical', 'slurry', 'compressed_air', 'other'],
  'Power Generation': ['water', 'steam', 'fuel_oil', 'natural_gas', 'hydraulic_oil', 'other'],
  'Mining':           ['water', 'slurry', 'hydraulic_oil', 'chemical', 'compressed_air', 'other'],
  'HVAC':             ['water', 'refrigerant', 'steam', 'compressed_air', 'other'],
  'Marine':           ['water', 'fuel_oil', 'hydraulic_oil', 'compressed_air', 'other'],
  'Manufacturing':    ['water', 'hydraulic_oil', 'compressed_air', 'steam', 'chemical', 'other'],
  'Other':            ALL_FLUID_TYPES.map((f) => f.value),
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
  fluidType: 'water',
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

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

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

  const availableFluids = ALL_FLUID_TYPES.filter((f) =>
    (INDUSTRY_FLUIDS[form.industry] ?? ALL_FLUID_TYPES.map((f) => f.value)).includes(f.value)
  );

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
    setStatusMsg('Analysing your requirements…');

    try {
      setTimeout(() => setStatusMsg('Determining process parameters…'), 5000);
      setTimeout(() => setStatusMsg('Selecting Malaysian suppliers by location…'), 12000);
      setTimeout(() => setStatusMsg('Evaluating confidence levels…'), 20000);
      setTimeout(() => setStatusMsg('Calculating transportation & total costs…'), 28000);
      setTimeout(() => setStatusMsg('Running risk assessment & lifespan analysis…'), 36000);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error ?? 'Generation failed');
      }

      const { recommendation } = await res.json();

      setStatusMsg('Saving your project…');
      const projectId = await createProject(user.uid, form, recommendation);

      toast.success('System design complete!');
      router.push(`/project/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setGenerating(false);
      setStatusMsg('');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const needsCustomFluid = form.fluidType === 'chemical' || form.fluidType === 'other';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">New Fluid System Project</h1>
          <p className="text-sm text-slate-400">
            AI determines process parameters, confidence levels, and lifespan from your inputs
          </p>
        </div>
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-10 text-center shadow-2xl">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Generating System Design</p>
              <p className="mt-1 text-sm text-slate-400">{statusMsg}</p>
            </div>
            <p className="text-xs text-slate-500">Typically 30–90 seconds</p>
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
                  {availableFluids.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
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
                placeholder="e.g. DOSH-approved equipment, Bomba-compliant fire suppression, SIRIM-certified, corrosion resistant for coastal environment, halal-certified for food processing…"
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
