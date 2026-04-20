export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0B0B10] px-6 py-10 text-[#F1F1F3]">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-sm font-semibold text-indigo-300 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          SH
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#8B8B9E]">SmartHire AI</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Loading enterprise workspace</h1>
        <p className="mt-3 text-sm leading-6 text-[#8B8B9E]">Preparing your session, navigation, and secure hiring tools.</p>
        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />
        </div>
      </div>
    </div>
  );
}