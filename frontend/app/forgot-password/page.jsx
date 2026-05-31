'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedEmail = String(email || '').trim();

    if (!trimmedEmail) {
      setError('Email is required.');
      setMessage('');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || 'Unable to send reset link.');
        return;
      }

      setMessage('Reset link sent! Check your email.');
      setEmail('');
    } catch (submitError) {
      setError(String(submitError?.message || 'Unable to send reset link.'));
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
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">Forgot Password</h1>
            <p className="text-sm leading-6 text-[#8B8B9E]">Enter your email and we&apos;ll send a password reset link.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition duration-200 ease-in-out hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending...' : 'Send Reset Link'}
            </button>

            {message ? <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
            {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-sm text-[#8B8B9E]">
            <span>Remembered your password?</span>
            <Link href="/login" className="font-medium text-[#F1F1F3] transition hover:text-indigo-300">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}