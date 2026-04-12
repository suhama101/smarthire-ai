'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LayoutDashboard, History, Upload, LogOut, Sparkles } from 'lucide-react';

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

export default function AuthenticatedShell({ children }) {
  const pathname = usePathname();
  const [authSession, setAuthSession] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const handleClick = () => setMenuOpen(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const navItems = useMemo(
    () => [
      { label: 'Home', href: '/' },
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Batch Upload', href: '/batch', icon: Upload },
      { label: 'History', href: '/history', icon: History },
    ],
    [],
  );

  const displayName = authSession?.user?.full_name || authSession?.user?.email || 'Guest';
  const initials = getInitials(displayName);
  const isAuthenticated = Boolean(authSession?.token);
  const visibleNavItems = navItems;

  function signOut(event) {
    event?.stopPropagation?.();

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('smarthire.auth');
      window.dispatchEvent(new Event('smarthire-auth-changed'));
    }

    setAuthSession(null);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_34%),linear-gradient(180deg,_#0F0F13_0%,_#0B0B10_100%)] text-[#F1F1F3]">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/10 bg-white/5 text-sm font-semibold text-indigo-300 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              SH
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.14em] text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text">
                SMART HIRE AI
              </p>
              <p className="text-xs text-[#8B8B9E]">Enterprise hiring intelligence</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {visibleNavItems.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group relative inline-flex items-center gap-2 text-sm font-medium transition duration-200 ease-in-out ${
                    active ? 'text-[#F1F1F3]' : 'text-[#8B8B9E] hover:text-[#F1F1F3]'
                  }`}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {item.label}
                  <span className={`absolute -bottom-1 left-0 h-px bg-indigo-500 transition-all duration-200 ${active ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </Link>
              );
            })}
          </nav>

          <div className="relative" onClick={(event) => event.stopPropagation()}>
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
                  <Link
                    href="/#auth"
                    className="mt-2 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-[#F1F1F3] transition duration-200 ease-in-out hover:bg-white/5"
                  >
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Go to sign in
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
