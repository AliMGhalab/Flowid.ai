'use client';

import Link from 'next/link';
import { ArrowRight, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from './AuthProvider';

/**
 * Auth-aware CTA buttons for the homepage.
 * Signed in → "Go to Dashboard" (single button).
 * Signed out → "Get Started Free" + "Sign In" (split buttons in hero, single signup in bottom).
 */

export function HeroCTAs() {
  const { user, loading } = useAuth();

  if (loading) {
    // Skeleton while auth resolves to avoid flicker
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <div className="h-14 w-48 animate-pulse rounded-xl bg-slate-800" />
        <div className="h-14 w-32 animate-pulse rounded-xl bg-slate-900" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
        >
          <LayoutDashboard className="h-5 w-5" />
          Go to Dashboard
          <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          href="/new-project"
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-lg font-medium text-slate-300 transition-all hover:border-slate-500 hover:text-white"
        >
          New Project
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <Link
        href="/signup"
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
      >
        Get Started Free
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
  );
}

export function BottomCTA() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="mx-auto h-14 w-56 animate-pulse rounded-xl bg-slate-800" />;
  }

  if (user) {
    return (
      <>
        <Link
          href="/new-project"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
        >
          Start a New Project
          <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Already signed in.{' '}
          <Link href="/dashboard" className="text-blue-400 hover:underline">
            Go to Dashboard
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Link
        href="/signup"
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
      >
        Get Started Free
        <ArrowRight className="h-5 w-5" />
      </Link>
      <p className="mt-4 text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
