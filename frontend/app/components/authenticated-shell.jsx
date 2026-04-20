'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BriefcaseBusiness, ChevronDown, FileText, Home, History, LogOut, Menu, Shield, Sparkles, X } from 'lucide-react';
import { clearAuthSession, readStoredAuth } from '../../src/lib/auth-session';

function getInitials(name) {
  const text = String(name || '').trim();
  if (!text) {
    return 'SH';
  }

  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function resolveRole(session) {
  const role = String(session?.user?.role || session?.user?.user_role || session?.user?.account_type || session?.role || '').toLowerCase();

  if (role === 'recruiter') {
    return 'recruiter';
  }

  if (role === 'candidate') {
    return 'candidate';
  }

  return 'guest';
}

function getNavItems(role) {
  const baseItems = [{ label: 'Home', href: '/', icon: Home }];

  if (role === 'recruiter') {
    return [
      ...baseItems,
      { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
      { label: 'Batch Upload', href: '/batch', icon: BriefcaseBusiness },
      { label: 'History', href: '/history', icon: History },
    ];
  }

  if (role === 'candidate') {
    return [
      ...baseItems,
      { label: 'My Analysis', href: '/dashboard', icon: Sparkles },
      { label: 'History', href: '/history', icon: FileText },
    ];
  }

  return [
    ...baseItems,
    { label: 'Login', href: '/login', icon: Shield },
    { label: 'Signup', href: '/signup', icon: LogOut },
  ];
}

export default function AuthenticatedShell({ children }) {
  const pathname = usePathname();
  const currentPathname = pathname || '/';
  const [authSession, setAuthSession] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthRoute = currentPathname === '/login' || currentPathname === '/signup';

  useEffect(() => {
    function syncAuthState() {
      setAuthSession(readStoredAuth());
    }

    syncAuthState();
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('smarthire-auth-changed', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('smarthire-auth-changed', syncAuthState);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [currentPathname]);

  const role = useMemo(() => resolveRole(authSession), [authSession]);
  const navItems = useMemo(() => getNavItems(role), [role]);

  const displayName = authSession?.user?.full_name || authSession?.user?.email || 'Guest';
  const initials = getInitials(displayName);
  const isAuthenticated = Boolean(authSession?.token);

  if (isAuthRoute) {
    return children;
  }

  function signOut(event) {
    event?.stopPropagation?.();
    clearAuthSession();
    setAuthSession(null);
    setMenuOpen(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_34%),linear-gradient(180deg,_#0F0F13_0%,_#0B0B10_100%)] text-[#F1F1F3]">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/10 bg-white/5 text-sm font-semibold text-indigo-300 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              SH
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.14em] text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text">SMART HIRE AI</p>
              <p className="text-xs text-[#8B8B9E]">Enterprise hiring intelligence</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-[#12121A] p-1.5 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPathname === item.href || currentPathname.startsWith(`${item.href}/`);

              return (
                <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-white text-[#0B0B10]' : 'text-[#8B8B9E] hover:bg-white/5 hover:text-[#F1F1F3]'}`}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#F1F1F3] transition duration-200 ease-in-out hover:border-indigo-500/40 hover:bg-white/10">
                  Login
                </Link>
                <Link href="/signup" className="rounded-[10px] bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white transition duration-200 ease-in-out hover:from-indigo-500 hover:to-violet-500">
                  Signup
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/10 bg-[#1A1A24] text-[#F1F1F3] transition duration-200 ease-in-out hover:border-indigo-500/40 hover:bg-white/5 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="relative hidden sm:block" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="inline-flex items-center gap-3 rounded-[10px] border border-white/10 bg-[#1A1A24] px-3 py-2 transition duration-200 ease-in-out hover:border-indigo-500/40 hover:bg-white/5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium text-[#F1F1F3]">{isAuthenticated ? displayName : 'Visitor'}</span>
                  <span className="block text-xs text-[#8B8B9E]">{isAuthenticated ? 'Authenticated' : 'Not signed in'}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-[#8B8B9E]" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-[#1A1A24] p-2 shadow-2xl shadow-black/30">
                  <div className="rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                    <p className="text-sm font-medium text-[#F1F1F3]">{isAuthenticated ? displayName : 'Guest session'}</p>
                    <p className="text-xs text-[#8B8B9E]">{isAuthenticated ? authSession?.user?.email : 'Sign in to unlock features'}</p>
                  </div>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={signOut}
                      className="mt-2 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm text-[#F1F1F3] transition duration-200 ease-in-out hover:bg-white/5"
                    >
                      <LogOut className="h-4 w-4 text-indigo-400" />
                      Sign out
                    </button>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <Link href="/login" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-[#F1F1F3] transition duration-200 ease-in-out hover:bg-white/5">
                        <Sparkles className="h-4 w-4 text-indigo-400" />
                        Go to login
                      </Link>
                      <Link href="/signup" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-[#F1F1F3] transition duration-200 ease-in-out hover:bg-white/5">
                        <Sparkles className="h-4 w-4 text-indigo-400" />
                        Go to signup
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/10 bg-[#111118]/95 px-4 py-4 lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentPathname === item.href || currentPathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${active ? 'border-white bg-white text-[#0B0B10]' : 'border-white/10 bg-white/5 text-[#B7B7C6] hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : (
                <div className="grid gap-2 sm:hidden">
                  <Link href="/login" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10">
                    Login
                  </Link>
                  <Link href="/signup" className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90">
                    Signup
                  </Link>
                </div>
              )}
            </nav>
          </div>
        ) : null}
      </header>

      <main className="smarthire-full-width-buttons mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
