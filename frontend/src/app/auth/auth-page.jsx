'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { persistAuthSession } from '../../lib/auth-session';
import { getApiUrl } from '../../lib/api';
import { getFriendlyApiError, sanitizeText } from '../../lib/input-utils';

export default function AuthPage({ mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('candidate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const redirectTarget = useMemo(() => {
    if (!isSignup) {
      const from = searchParams?.get('from') || '';
      const normalized = from.trim();

      if (normalized.startsWith('/') && !normalized.startsWith('//')) {
        return normalized;
      }
    }

    return '/dashboard';
  }, [isSignup, searchParams]);

  function clearFieldError(field) {
    if (!fieldErrors[field]) {
      return;
    }

    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextFieldErrors = {};
    const trimmedEmail = sanitizeText(email);
    const trimmedFullName = sanitizeText(fullName);
    const trimmedPassword = sanitizeText(password);
    const trimmedConfirmPassword = sanitizeText(confirmPassword);

    if (!trimmedEmail) {
      nextFieldErrors.email = 'Email is required.';
    }

    if (!trimmedPassword) {
      nextFieldErrors.password = 'Password is required.';
    }

    if (isSignup) {
      if (!trimmedFullName) {
        nextFieldErrors.fullName = 'Full name is required.';
      }

      if (!trimmedConfirmPassword) {
        nextFieldErrors.confirmPassword = 'Please confirm your password.';
      } else if (trimmedPassword && trimmedPassword !== trimmedConfirmPassword) {
        nextFieldErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError('');
      return;
    }

    setBusy(true);
    setError('');
    setFieldErrors({});

    try {
      const endpoint = isSignup ? getApiUrl('auth/signup') : getApiUrl('auth/login');
      const payload = isSignup
        ? {
            email: trimmedEmail,
            password: trimmedPassword,
            full_name: trimmedFullName,
            role,
          }
        : {
            email: trimmedEmail,
            password: trimmedPassword,
          };

      const response = await axios.post(endpoint, payload);
      const token = response.data?.token || '';
      const user = response.data?.user || null;

      if (!token) {
        throw new Error('Authentication response did not include a token.');
      }

      persistAuthSession({ token, user });
      router.push(redirectTarget);
    } catch (authError) {
      setError(getFriendlyApiError(authError, 'Authentication failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.24),_transparent_38%),linear-gradient(180deg,_#050509_0%,_#0B0B10_100%)] px-6 py-10 text-[#F1F1F3]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-[#14141C]/95 p-8 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8B8B9E]">SmartHire AI</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">
              {isSignup ? 'Create your account' : 'Sign in to continue'}
            </h1>
            <p className="text-sm leading-6 text-[#8B8B9E]">
              {isSignup
                ? 'Set up a dedicated candidate or recruiter account and return to the hiring workspace.'
                : 'Use your existing SmartHire credentials to access the dashboard and analysis tools.'}
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="you@company.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />
                {fieldErrors.email ? <p className="text-sm text-rose-300">{fieldErrors.email}</p> : null}
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError('password');
                  }}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />
                {fieldErrors.password ? <p className="text-sm text-rose-300">{fieldErrors.password}</p> : null}
              </div>
            </div>

            {isSignup ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      clearFieldError('fullName');
                    }}
                    placeholder="Full Name"
                    className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {fieldErrors.fullName ? <p className="text-sm text-rose-300">{fieldErrors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearFieldError('confirmPassword');
                    }}
                    placeholder="Confirm Password"
                    className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {fieldErrors.confirmPassword ? <p className="text-sm text-rose-300">{fieldErrors.confirmPassword}</p> : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8B8B9E]">Role</p>
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#0F0F13] p-2">
                    <button
                      type="button"
                      onClick={() => setRole('candidate')}
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                        role === 'candidate'
                          ? 'bg-indigo-600 text-white'
                          : 'text-[#8B8B9E] hover:bg-white/5 hover:text-[#F1F1F3]'
                      }`}
                    >
                      Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('recruiter')}
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                        role === 'recruiter'
                          ? 'bg-indigo-600 text-white'
                          : 'text-[#8B8B9E] hover:bg-white/5 hover:text-[#F1F1F3]'
                      }`}
                    >
                      Recruiter
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition duration-200 ease-in-out hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Working...' : isSignup ? 'Create account' : 'Login'}
            </button>

            {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-sm text-[#8B8B9E]">
            <span>{isSignup ? 'Already have an account?' : 'Need an account?'}</span>
            <Link
              href={isSignup ? '/login' : '/signup'}
              className="font-medium text-[#F1F1F3] transition hover:text-indigo-300"
            >
              {isSignup ? 'Login' : 'Signup'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}