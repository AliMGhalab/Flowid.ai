'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getUserProjects, deleteProject } from '@/lib/firestore';
import type { Project } from '@/types';
import {
  Plus,
  Droplets,
  Calendar,
  Trash2,
  ChevronRight,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFluidLabel } from '@/lib/fluidLabels';

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-400/10 text-green-400',
  medium: 'bg-yellow-400/10 text-yellow-400',
  high: 'bg-orange-400/10 text-orange-400',
  critical: 'bg-red-400/10 text-red-400',
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatCurrency(n: number) {
  return 'RM ' + new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getUserProjects(user.uid)
      .then(setProjects)
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setFetching(false));
  }, [user]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Welcome back, {user.displayName?.split(' ')[0] ?? 'Engineer'}
          </h1>
          <p className="mt-1 text-slate-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Link
          href="/new-project"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {/* Projects */}
      {fetching ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="mb-3 h-5 w-3/4 rounded-lg bg-slate-800" />
              <div className="mb-2 h-4 w-1/2 rounded-lg bg-slate-800" />
              <div className="h-4 w-1/3 rounded-lg bg-slate-800" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 py-24 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-slate-600" />
          <h3 className="mb-2 text-lg font-semibold text-white">No projects yet</h3>
          <p className="mb-2 max-w-sm text-sm text-slate-400">
            Describe your fluid system and get a complete BOM, risk register, and cost estimate in under 4 minutes.
          </p>
          <p className="mb-6 max-w-sm text-xs text-slate-500">
            Malaysian suppliers · MYR pricing · DOSH &amp; BOMBA compliance
          </p>
          <Link
            href="/new-project"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Generate Your First System
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const risk = project.recommendation?.risk_assessment?.overall_risk_level;
            type CostEst = { total_cost_myr?: number; total_cost_usd?: number };
            const costEst = project.recommendation?.cost_estimate as CostEst | undefined;
            const total = costEst?.total_cost_myr ?? costEst?.total_cost_usd;
            const systemType = project.recommendation?.system_type;

            return (
              <div
                key={project.id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(project.id, project.projectName)}
                  disabled={deletingId === project.id}
                  className="absolute right-4 top-4 hidden rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-red-400/10 hover:text-red-400 group-hover:flex"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <Link href={`/project/${project.id}`} className="block">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10">
                      <Droplets className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-white group-hover:text-blue-300">
                        {project.projectName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {project.input.industry} · {getFluidLabel(project.input.fluidType, project.input.customFluidType)}
                        {project.input.malaysiaState && ` · ${project.input.malaysiaState.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                  </div>

                  {systemType && (
                    <p className="mb-3 text-xs text-slate-400 line-clamp-1">{systemType}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {risk && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_COLORS[risk] ?? RISK_COLORS.low}`}
                        >
                          {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
                        </span>
                      )}
                    </div>
                    {total !== undefined && (
                      <span className="text-sm font-medium text-green-400">
                        {formatCurrency(total)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(project.createdAt)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Info bar */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-400">Engineering disclaimer — </span>
          All outputs are AI-generated feasibility documents intended to support the work of a licensed professional engineer.
          Review and verify all designs before procurement, fabrication, or installation.
          Reports do not constitute a certified design under DOSH, BOMBA, or any Malaysian regulatory framework.
        </p>
      </div>
    </div>
  );
}
