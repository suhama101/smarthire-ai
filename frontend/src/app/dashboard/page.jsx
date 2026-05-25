'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readStoredAuth } from '../../lib/auth-session';
import CandidateWorkbench from './components/CandidateWorkbench';

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = readStoredAuth();

    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    setIsAuthenticated(true);
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
        <CandidateWorkbench />
      </div>
    </div>
  );
}
