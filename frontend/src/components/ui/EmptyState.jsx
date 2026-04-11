export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#1A1A24] px-6 py-10 text-center text-[#F1F1F3] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      {icon ? <div className="mb-4 text-indigo-400">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[#8B8B9E]">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
