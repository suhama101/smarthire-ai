'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token') || '';
    setToken(resetToken);

    if (!resetToken) {
      setError('Reset token is missing. Open the link from your email again.');
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedNewPassword = String(newPassword || '').trim();
    const trimmedConfirmPassword = String(confirmPassword || '').trim();

    if (!trimmedNewPassword) {
      setError('New password is required.');
      setMessage('');
      return;
    }

    if (!trimmedConfirmPassword) {
      setError('Please confirm your password.');
      setMessage('');
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match.');
      setMessage('');
      return;
    }

    if (!token) {
      setError('Reset token is missing. Open the link from your email again.');
      setMessage('');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: trimmedNewPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update password.');
      }

      setMessage('Password updated! Redirecting to login...');
      router.push('/login');
    } catch (submitError) {
      setError(submitError?.message || 'Unable to update password.');
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
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">Reset Password</h1>
            <p className="text-sm leading-6 text-[#8B8B9E]">Create a new password for your account.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#66667A] focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition duration-200 ease-in-out hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Updating...' : 'Update Password'}
            </button>

            {message ? <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
            {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-sm text-[#8B8B9E]">
            <span>Back to sign in</span>
            <Link href="/login" className="font-medium text-[#F1F1F3] transition hover:text-indigo-300">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}