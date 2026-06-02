'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Upload,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Confidence = Record<string, number>;
interface Extracted {
  projectName?: string;
  industry?: string;
  fluidType?: string;
  customFluidType?: string | null;
  malaysiaState?: string;
  siteEnvironment?: string;
  application?: string;
  budget?: number;
  specialRequirements?: string;
  scaleFlowRateValue?: number | null;
  scaleFlowRateUnit?: string | null;
  scaleVolumeMonthlyValue?: number | null;
  scaleVolumeMonthlyUnit?: string | null;
  _confidence?: Confidence;
}

const CONF_LABEL = (n: number) =>
  n >= 90 ? 'extracted' : n >= 70 ? 'inferred' : n >= 50 ? 'guessed' : 'defaulted';
const CONF_COLOR = (n: number) =>
  n >= 90
    ? 'text-green-400 bg-green-400/10 border-green-400/30'
    : n >= 70
    ? 'text-blue-400 bg-blue-400/10 border-blue-400/30'
    : n >= 50
    ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
    : 'text-red-400 bg-red-400/10 border-red-400/30';

export default function FromDocumentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'text' | 'pdf'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'text' && !text.trim()) {
      setError('Paste a document, email, or RFQ text to extract from.');
      return;
    }
    if (mode === 'pdf' && !file) {
      setError('Upload a PDF document.');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      if (mode === 'text') form.set('text', text);
      if (mode === 'pdf' && file) form.set('file', file);

      const res = await fetch('/api/extract-requirements', { method: 'POST', body: form });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'Extraction failed');
      }
      const data = await res.json();
      setExtracted(data.extracted as Extracted);
      toast.success('Requirements extracted — review and confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (!extracted) return;
    // Hand off to /new-project via sessionStorage
    const payload = {
      projectName: extracted.projectName ?? '',
      industry: extracted.industry ?? '',
      fluidType: extracted.fluidType ?? '',
      customFluidType: extracted.customFluidType ?? '',
      malaysiaState: extracted.malaysiaState ?? '',
      siteEnvironment: extracted.siteEnvironment ?? '',
      application: extracted.application ?? '',
      budget: extracted.budget ?? 500000,
      specialRequirements: extracted.specialRequirements ?? '',
      scaleFlowRateValue: extracted.scaleFlowRateValue ?? undefined,
      scaleFlowRateUnit: extracted.scaleFlowRateUnit ?? undefined,
      scaleVolumeMonthlyValue: extracted.scaleVolumeMonthlyValue ?? undefined,
      scaleVolumeMonthlyUnit: extracted.scaleVolumeMonthlyUnit ?? undefined,
    };
    try {
      sessionStorage.setItem('flowid:prefill', JSON.stringify(payload));
    } catch {
      // sessionStorage might be disabled — fall back to query params
    }
    router.push('/new-project?prefill=1');
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Confirmation view ──────────────────────────────────────────────────────
  if (extracted) {
    const conf = extracted._confidence ?? {};
    const fields: Array<{ key: keyof Extracted; label: string; value: string; confKey: string }> = [
      { key: 'projectName',          label: 'Project name',            value: extracted.projectName ?? '—',                          confKey: 'projectName' },
      { key: 'industry',             label: 'Industry',                value: extracted.industry ?? '—',                              confKey: 'industry' },
      { key: 'fluidType',            label: 'Fluid type',              value: (extracted.customFluidType || extracted.fluidType) ?? '—', confKey: 'fluidType' },
      { key: 'malaysiaState',        label: 'Malaysian state',         value: (extracted.malaysiaState ?? '—').replace(/_/g, ' '),    confKey: 'malaysiaState' },
      { key: 'siteEnvironment',      label: 'Site environment',        value: extracted.siteEnvironment ?? '—',                       confKey: 'siteEnvironment' },
      { key: 'budget',               label: 'Budget (MYR)',            value: extracted.budget ? `RM ${extracted.budget.toLocaleString('en-MY')}` : '—', confKey: 'budget' },
      { key: 'specialRequirements',  label: 'Special requirements',    value: extracted.specialRequirements || '—',                   confKey: 'specialRequirements' },
      { key: 'application',          label: 'Application description', value: extracted.application ?? '—',                           confKey: 'application' },
    ];

    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/new-project" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to manual form
        </Link>

        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Extraction complete
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Review extracted requirements</h1>
          <p className="mt-2 text-sm text-slate-400">
            Confidence levels show how reliable each field is. Click any field to edit. When you&apos;re happy, click
            <span className="font-medium text-white"> &quot;Confirm &amp; Continue&quot;</span> to pre-fill the project form.
          </p>
        </div>

        <div className="space-y-3">
          {fields.map((f) => {
            const c = conf[f.confKey as keyof Confidence] ?? 50;
            return (
              <div key={f.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{f.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONF_COLOR(c)}`}>
                    {c}% · {CONF_LABEL(c)}
                  </span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap break-words">{f.value}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={() => setExtracted(null)}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            Start over
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Confirm &amp; Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Input view ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/new-project" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to manual form
      </Link>

      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered intake
        </div>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Start from a document</h1>
        <p className="mt-2 max-w-xl text-slate-400">
          Drop a client RFQ, email, technical specification, or meeting notes. Flowid.ai will extract the
          project requirements and pre-fill the form — no manual typing.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-5 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => setMode('text')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          Paste text
        </button>
        <button
          onClick={() => setMode('pdf')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'pdf' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload PDF
        </button>
      </div>

      {/* Inputs */}
      {mode === 'text' ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste a client RFQ, email, technical specification, or meeting notes. For example:\n\n"We are looking for a cooling water system for our new palm oil mill in Pengerang, Johor. Budget around RM 800k. Need to handle 60 m³/hr cooling load, 24/7 operation, with DOSH compliance. Pumps should have backup."`}
            rows={14}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-500"
          />
          <p className="mt-2 text-xs text-slate-500">{text.length.toLocaleString()} characters</p>
        </div>
      ) : (
        <div>
          <label className="block">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center transition-colors hover:border-slate-500">
              <Upload className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm font-medium text-white">
                {file ? file.name : 'Click to upload a PDF'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB · ${file.type || 'application/pdf'}`
                  : 'Max 10 MB · text-based PDFs only (scanned image-only PDFs need OCR)'}
              </p>
            </div>
          </label>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || (mode === 'text' && !text.trim()) || (mode === 'pdf' && !file)}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting requirements…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extract Requirements
            </>
          )}
        </button>
      </div>
    </div>
  );
}
