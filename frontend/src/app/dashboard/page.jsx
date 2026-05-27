'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readStoredAuth } from '../../lib/auth-session';
import CandidateWorkbench from './components/CandidateWorkbench';

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('guest');

  useEffect(() => {
    const stored = readStoredAuth();

    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    setIsAuthenticated(true);
    setRole(String(stored?.user?.role || stored?.user?.user_role || stored?.user?.account_type || stored?.role || '').toLowerCase());
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
          <p className="text-sm font-medium text-[#8B8B9E]">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {role === 'recruiter' ? (
          <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
            <p className="text-sm text-[#8B8B9E]">Use Batch Upload to analyze multiple candidates at once.</p>
            <Link
              href="/batch"
              className="mt-5 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90"
            >
              Go to Batch Upload
            </Link>
          </section>
        ) : (
          <CandidateWorkbench />
        )}
      </div>
    </div>
  );
}
