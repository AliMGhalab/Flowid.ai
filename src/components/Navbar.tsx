'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { LayoutDashboard, Plus, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logOut();
    router.push('/');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.jpg"
              alt="Flowid.ai"
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-white">
              Flowid<span className="text-blue-400">.ai</span>
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-800" />
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors sm:flex ${
                    pathname === '/dashboard'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                <Link
                  href="/new-project"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  New Project
                </Link>

                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-lg p-1 text-slate-400 transition-colors hover:text-white"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {initials}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
                      <div className="border-b border-slate-700 px-4 py-3">
                        <p className="truncate text-sm font-medium text-white">
                          {user.displayName ?? 'User'}
                        </p>
                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white sm:hidden"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-slate-700"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-slate-400 transition-colors hover:text-white"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
