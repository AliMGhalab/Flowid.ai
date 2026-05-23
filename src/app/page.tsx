import Link from 'next/link';
import {
  ArrowRight,
  Package,
  ShieldAlert,
  Wrench,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  Droplets,
  MapPin,
  FileDown,
  Clock,
  BarChart3,
  Zap,
  RefreshCw,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { label: 'Oil & Gas',          sub: 'Upstream, midstream & RAPID' },
  { label: 'Palm Oil',           sub: '475+ mills across Malaysia' },
  { label: 'Food & Beverage',    sub: 'CIP, steam & cooling systems' },
  { label: 'Water Treatment',    sub: 'Municipal & industrial' },
  { label: 'Pharmaceutical',     sub: 'PW, WFI & clean utilities' },
  { label: 'Semiconductor / E&E',sub: 'UPW & chemical distribution' },
  { label: 'Rubber & Latex',     sub: 'Latex transfer & preservation' },
  { label: 'Chemicals',          sub: 'Acids, alkalis & solvents' },
];

const STANDARDS = [
  { code: 'DOSH FMA 1967',      desc: 'Pressure vessels & machinery' },
  { code: 'BOMBA',              desc: 'Fire & flammable materials' },
  { code: 'SIRIM',              desc: 'Product certification' },
  { code: 'PETRONAS PTS',       desc: 'Oil & gas projects' },
  { code: 'DOE Malaysia',       desc: 'Environmental compliance' },
  { code: 'MS Standards',       desc: 'Malaysian Standards' },
];

const FEATURES = [
  {
    icon: Package,
    title: 'Procurement-Ready BOM',
    description:
      'Every pump, valve, strainer, instrument, and fitting — with real Malaysian supplier names, model numbers, and MYR pricing.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: ShieldAlert,
    title: 'HAZOP Risk Register',
    description:
      'Automated hazard identification covering mechanical, chemical, thermal, and operational risks with DOSH and BOMBA mitigation guidance.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Wrench,
    title: 'Maintenance Schedules',
    description:
      'Structured preventive maintenance programs from daily checks to annual overhauls — with shutdown requirements flagged.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: DollarSign,
    title: 'Full Cost Breakdown',
    description:
      'Equipment, installation, engineering, commissioning, and transportation costs — compared against your budget in MYR.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: BarChart3,
    title: 'AI Confidence Scores',
    description:
      'Every component is rated 0–100% for selection confidence and expected lifespan — so you know exactly where to focus your review.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: RefreshCw,
    title: 'Component Alternatives',
    description:
      'Two alternatives for every component from different Malaysian suppliers — with cost comparison and delivery advantages.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: FileDown,
    title: 'PDF & Excel Export',
    description:
      'Download a professional 11-section engineering report as PDF or a 7-sheet Excel workbook ready for procurement and review.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
  {
    icon: MapPin,
    title: 'Malaysian Suppliers Only',
    description:
      'Suppliers are selected by proximity to your project state — from Klang Valley to East Malaysia, with logistics costs calculated.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Describe Your Project',
    description:
      'Select your industry, fluid type, application, Malaysian state, site environment, and budget. Optionally specify flow rate or monthly volume.',
  },
  {
    number: '02',
    title: 'AI Designs the System',
    description:
      'The AI engine determines process parameters, sizes all equipment to your scale, selects real Malaysian suppliers, and applies DOSH / BOMBA / SIRIM compliance.',
  },
  {
    number: '03',
    title: 'Review, Export & Procure',
    description:
      'Browse the full BOM, risk register, and cost breakdown. Check live supplier prices. Export as PDF engineering report or Excel for procurement.',
  },
];

const OUTPUTS = [
  'Complete BOM — every pump, valve, strainer, instrument, fitting, and control panel',
  'Process parameters — flow rate, pressure, temperature, fluid velocity (AI-determined)',
  'Malaysian supplier names and MYR pricing for every line item',
  'Transportation cost from supplier city to your project state',
  'HAZOP-style risk register with likelihood, severity, and mitigation',
  'Preventive maintenance schedule (daily through annual)',
  'Piping specification — material, schedule, connection type, insulation',
  'Instrumentation list with tag numbers (PT, FT, TT, LT)',
  'DOSH, BOMBA, SIRIM, PETRONAS PTS compliance standards',
  'Recommended vendors ranked by proximity to your state',
  'AI confidence scores and expected lifespan per component',
  'Exportable as PDF report or Excel BOM workbook',
];

// ─── Mock BOM data (Malaysian suppliers, MYR) ─────────────────────────────────

const MOCK_COMPONENTS = [
  { tag: 'C-001', name: 'Centrifugal Pump, 15 kW',     supplier: 'Grundfos Malaysia',        cost: 'RM 14,800' },
  { tag: 'C-002', name: 'Gate Valve DN150 (SS316)',     supplier: 'KITZ Malaysia, PJ',         cost: 'RM 2,100'  },
  { tag: 'C-003', name: 'Y-Strainer 6" Sch40',         supplier: 'Parker Hannifin (M)',        cost: 'RM 1,650'  },
  { tag: 'PT-101', name: 'Pressure Transmitter 4–20mA', supplier: 'Endress+Hauser Malaysia',   cost: 'RM 4,200'  },
  { tag: 'FT-101', name: 'Electromagnetic Flow Meter',  supplier: 'Yokogawa Malaysia',         cost: 'RM 8,500'  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-slate-950" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.07) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-600/20 bg-blue-600/10 px-4 py-1.5 text-sm text-blue-400">
              <MapPin className="h-3.5 w-3.5" />
              Built for Malaysian Industry
            </div>

            <h1 className="mb-6 text-balance text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Fluid System Engineering
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                in Minutes, Not Weeks
              </span>
            </h1>

            <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Describe your project. Get a complete industrial fluid system specification —
              full BOM, Malaysian supplier pricing in MYR, HAZOP risk register,
              maintenance schedule, and a PDF engineering report ready to share.
            </p>
            <p className="mx-auto mb-10 max-w-xl text-sm text-slate-500">
              Designed for plant engineers, project managers, and EPC contractors in Malaysia.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
              >
                Generate Your First System Free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-lg font-medium text-slate-300 transition-all hover:border-slate-500 hover:text-white"
              >
                Sign In
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
              {[
                { value: '< 4 min', label: 'Generation time' },
                { value: 'MYR',     label: 'All prices in Ringgit' },
                { value: '13',      label: 'Malaysian industries' },
                { value: '40+',     label: 'Fluid types' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance standards strip ───────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Malaysian Compliance Standards Referenced in Every Report
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {STANDARDS.map((s) => (
              <div
                key={s.code}
                title={s.desc}
                className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300"
              >
                <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                {s.code}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Industries ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">
            Covering Malaysia&apos;s Key Industrial Sectors
          </h2>
          <p className="text-slate-400">
            Industry-specific fluid types, equipment, and compliance for each sector.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INDUSTRIES.map((ind) => (
            <div
              key={ind.label}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 transition-colors hover:border-slate-700"
            >
              <p className="font-semibold text-white text-sm">{ind.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{ind.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">How It Works</h2>
            <p className="text-slate-400">From project description to full engineering package in 3 steps</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.number} className="relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-2/3 top-8 hidden h-px w-1/2 bg-gradient-to-r from-slate-600 to-transparent sm:block lg:left-3/4" />
                )}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-600/30 bg-blue-600/10 text-2xl font-bold text-blue-400">
                  {s.number}
                </div>
                <h3 className="mb-2 font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
            Everything a Senior Process Engineer Would Produce
          </h2>
          <p className="mx-auto max-w-xl text-slate-400">
            The same deliverables that take an engineer days to compile —
            generated in under 4 minutes, with Malaysian market data built in.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-slate-700"
            >
              <div className={`mb-4 inline-flex rounded-xl ${f.bg} p-3`}>
                <f.icon className={`h-6 w-6 ${f.color}`} />
              </div>
              <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you get + Mock BOM ──────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-900/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">

            {/* Outputs list */}
            <div>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                A Complete Engineering Package
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-slate-400">
                Every project generates a structured, procurement-ready specification
                covering the full scope — from first principles to vendor recommendations.
              </p>
              <ul className="space-y-2.5">
                {OUTPUTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mock BOM card */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              {/* Card header */}
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                  <Droplets className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">Cooling Water Transfer System</div>
                  <div className="text-xs text-slate-400">Oil & Gas · Kerteh, Terengganu · 350 m³/hr</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
                    Low Risk
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />3.8 min
                  </span>
                </div>
              </div>

              {/* Components */}
              <div className="space-y-2 mb-3">
                {MOCK_COMPONENTS.map((row) => (
                  <div
                    key={row.tag}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-blue-400 w-14 shrink-0">{row.tag}</span>
                    <span className="flex-1 text-xs text-white truncate">{row.name}</span>
                    <span className="text-xs text-slate-500 hidden sm:block shrink-0">{row.supplier}</span>
                    <span className="text-xs font-medium text-green-400 shrink-0">{row.cost}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
                  <span className="font-mono text-xs text-slate-500 w-14 shrink-0">+17</span>
                  <span className="flex-1 text-xs text-slate-500 italic">more components…</span>
                </div>
              </div>

              {/* Totals */}
              <div className="flex items-center justify-between rounded-lg bg-blue-600/10 border border-blue-600/20 px-3 py-2.5">
                <span className="text-sm text-slate-300">Total Estimate (incl. transport & installation)</span>
                <span className="font-bold text-white">RM 312,000</span>
              </div>

              {/* Badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  DOSH FMA 1967
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  PETRONAS PTS
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  87% AI Confidence
                </span>
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                  Within Budget
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Malaysia-specific matters ────────────────────────────────────── */}
      <section className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              Why Generic Tools Fall Short
            </h2>
            <p className="mx-auto max-w-xl text-slate-400">
              Global engineering tools give you USD pricing and US suppliers.
              That&apos;s not good enough for a procurement engineer in Penang or Kerteh.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: DollarSign,
                color: 'text-green-400',
                bg: 'bg-green-400/10',
                title: 'MYR Pricing with SST',
                body: 'Every cost is in Malaysian Ringgit, inclusive of SST and import duties. East Malaysia logistics premiums are applied automatically.',
              },
              {
                icon: MapPin,
                color: 'text-blue-400',
                bg: 'bg-blue-400/10',
                title: 'Suppliers Near Your Site',
                body: 'Grundfos Shah Alam, KITZ Petaling Jaya, Endress+Hauser Malaysia — selected by proximity to your project state to minimise lead time and shipping cost.',
              },
              {
                icon: ShieldAlert,
                color: 'text-orange-400',
                bg: 'bg-orange-400/10',
                title: 'Malaysian Regulations',
                body: 'DOSH FMA 1967 for pressure vessels, BOMBA for flammable materials, SIRIM certification, DOE for chemical handling, PETRONAS PTS for O&G projects.',
              },
              {
                icon: Package,
                color: 'text-purple-400',
                bg: 'bg-purple-400/10',
                title: 'Local Fluid Knowledge',
                body: 'Crude palm oil, POME, latex, ammonia preservation, CPO transfer — fluids specific to Malaysian industry that generic tools simply do not know.',
              },
              {
                icon: Zap,
                color: 'text-cyan-400',
                bg: 'bg-cyan-400/10',
                title: 'Transport Cost Calculated',
                body: 'Shipment cost from supplier city (Shah Alam, Penang, JB) to your project state is calculated as a separate cost line — not hidden in equipment cost.',
              },
              {
                icon: Clock,
                color: 'text-amber-400',
                bg: 'bg-amber-400/10',
                title: 'Honest Lead Times',
                body: 'East Malaysia deliveries realistically take 7–14 days by sea. Peninsular deliveries 1–3 days. The report reflects actual Malaysian logistics, not catalogue estimates.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className={`mb-4 inline-flex rounded-xl ${card.bg} p-3`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <h3 className="mb-2 font-semibold text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-400">Engineering Disclaimer — </span>
            Flowid.ai outputs are AI-generated engineering feasibility documents intended to support,
            not replace, the judgement of a licensed professional engineer.
            All recommendations must be reviewed and stamped by a qualified PE before implementation,
            fabrication, or procurement. Results are guidance only and do not constitute a certified
            engineering design under DOSH, BOMBA, or any other Malaysian regulatory framework.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to Design Your First System?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-slate-400">
            No credit card. No setup. Describe your project and get a full
            engineering specification in under 4 minutes.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
          >
            Generate Your First System Free
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">
                Flowid<span className="text-blue-400">.ai</span>
              </span>
              <span className="text-xs text-slate-600 ml-2">AI Fluid System Engineering · Malaysia</span>
            </div>
            <p className="text-xs text-slate-600 text-center sm:text-right max-w-sm">
              AI-generated outputs are for engineering guidance only.
              Verify all designs with a licensed professional engineer before implementation.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
