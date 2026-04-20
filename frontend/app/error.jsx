'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B0B10] px-6 py-10 text-[#F1F1F3]">
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200">
          Something went wrong
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">We could not load this part of SmartHire AI.</h1>
        <p className="mt-3 text-sm leading-6 text-[#8B8B9E]">Please try again in a moment. If the issue continues, refresh the page and check your connection.</p>
        <button type="button" onClick={reset} className="mt-8 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90">
          Retry
        </button>
      </div>
    </div>
  );
}