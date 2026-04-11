'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function readStoredAuth() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem('smarthire.auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AuthenticatedShell({ children }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    function syncAuthState() {
      const stored = readStoredAuth();
      setIsAuthenticated(Boolean(stored?.token));
    }

    syncAuthState();
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('smarthire-auth-changed', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('smarthire-auth-changed', syncAuthState);
    };
  }, []);

  const navItems = [
    { label: 'Overview', href: '/' },
    { label: 'Access Layer', href: '#access-layer' },
    { label: 'Resume Analysis', href: '#resume-analysis' },
    { label: 'Job Matching', href: '#job-matching' },
    { label: 'Learning Plan', href: '#learning-plan' },
    { label: 'Batch Upload', href: '/batch' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-8 text-slate-900 md:px-6">
      <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />
      <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      {isAuthenticated ? (
        <aside className="fixed left-4 top-8 hidden h-[calc(100vh-4rem)] w-[280px] lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-950 px-5 py-5 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.55)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
                SH
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">SmartHire AI</p>
                <p className="text-sm text-slate-300">Global Hiring Console</p>
              </div>
            </div>

            <nav className="mt-6 space-y-2 text-sm">
              {navItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`block rounded-2xl px-4 py-3 font-medium transition ${
                      isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
              <p className="mt-2 text-sm text-slate-200">Designed for structured recruiting workflows, session persistence, and role-based handoff.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quick Snapshot</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Session</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Authenticated</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Active</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mode</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Role-aware</p>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      <main className={`relative mx-auto w-full max-w-7xl space-y-4 ${isAuthenticated ? 'lg:pl-[304px]' : ''}`}>{children}</main>
    </div>
  );
}
