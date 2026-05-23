import Link from 'next/link';
import {
  ArrowRight,
  Package,
  ShieldAlert,
  Wrench,
  DollarSign,
  Zap,
  CheckCircle2,
  ChevronRight,
  Droplets,
} from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'Complete Component Lists',
    description:
      'Every pump, valve, filter, and fitting with real manufacturer specs, model numbers, and cost estimates.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: ShieldAlert,
    title: 'HAZOP-Style Risk Assessment',
    description:
      'Automated hazard identification covering mechanical, chemical, thermal, and operational risks with mitigation strategies.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Wrench,
    title: 'Maintenance Schedules',
    description:
      'Structured preventive maintenance programs organized by daily, weekly, monthly, and annual tasks.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: DollarSign,
    title: 'Budget-Aware Estimates',
    description:
      'Itemized cost breakdowns for equipment, installation, and commissioning — compared against your budget.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
];

const steps = [
  {
    number: '01',
    title: 'Input Process Parameters',
    description:
      'Enter fluid type, flow rate, pressure, temperature, industry, location, and budget.',
  },
  {
    number: '02',
    title: 'AI Designs Your System',
    description:
      'DeepSeek V3 analyzes your requirements and generates a complete engineering specification.',
  },
  {
    number: '03',
    title: 'Review & Export',
    description:
      'Browse components, risks, and maintenance tasks. Save projects to your dashboard.',
  },
];

const outputs = [
  'Pump & compressor sizing with model numbers',
  'Valve selection (isolation, control, relief)',
  'Pipe material, schedule, and connection type',
  'Instrumentation tags and specifications',
  'Vendor recommendations for each component',
  'Applicable compliance standards (ASME, API, ISO)',
  'Lead time and procurement guidance',
  'Engineering notes & commissioning advice',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
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
        {/* Glow */}
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-600/20 bg-blue-600/10 px-4 py-1.5 text-sm text-blue-400">
              <Zap className="h-3.5 w-3.5" />
              Powered by DeepSeek V3
            </div>

            <h1 className="mb-6 text-balance text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Design Fluid Systems
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                in Minutes, Not Weeks
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Input your process parameters and get a complete industrial fluid system
              recommendation — components, materials, suppliers, risk assessment, and maintenance
              schedule.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
              >
                Start for Free
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
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
            Everything a Sales Engineer Would Provide
          </h2>
          <p className="mx-auto max-w-xl text-slate-400">
            Flowid.ai generates the same deliverables a senior fluid systems engineer would spend
            days producing — in under a minute.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
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

      {/* How it works */}
      <section className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">How It Works</h2>
            <p className="text-slate-400">From parameters to complete specification in 3 steps</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.number} className="relative flex flex-col items-center text-center">
                {i < steps.length - 1 && (
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

      {/* What you get */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              A Complete Engineering Package
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-400">
              Every project generates a structured specification that covers all aspects of the
              fluid system — ready for review, procurement, and commissioning.
            </p>
            <ul className="space-y-3">
              {outputs.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual mockup */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Droplets className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Cooling Water System</div>
                <div className="text-xs text-slate-400">Oil & Gas · 500 GPM · 150 PSI</div>
              </div>
              <span className="ml-auto rounded-full bg-green-400/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                Low Risk
              </span>
            </div>

            <div className="space-y-2">
              {[
                { tag: 'C-001', name: 'Centrifugal Pump', supplier: 'Flowserve', cost: '$12,400' },
                { tag: 'C-002', name: 'Gate Valve DN150', supplier: 'Crane Co', cost: '$860' },
                { tag: 'C-003', name: 'Y-Strainer 6"', supplier: 'Hayward', cost: '$1,200' },
                { tag: 'PT-101', name: 'Pressure Transmitter', supplier: 'E+H', cost: '$1,350' },
              ].map((row) => (
                <div
                  key={row.tag}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2.5"
                >
                  <span className="font-mono text-xs text-blue-400">{row.tag}</span>
                  <span className="flex-1 text-sm text-white">{row.name}</span>
                  <span className="text-xs text-slate-400">{row.supplier}</span>
                  <span className="text-xs font-medium text-green-400">{row.cost}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-600/10 px-3 py-2.5">
              <span className="text-sm text-slate-300">Estimated Total</span>
              <span className="font-semibold text-white">$87,500</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to Design Your First System?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-slate-400">
            Join engineers using Flowid.ai to cut specification time from days to minutes.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">
                Flowid<span className="text-blue-400">.ai</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              AI-generated recommendations are for engineering guidance only. Verify with a
              licensed engineer before implementation.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
