function badgeTone(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 'bg-slate-700 text-slate-200';
  }

  if (score >= 80) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  }

  if (score >= 60) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  }

  return 'bg-rose-500/15 text-rose-300 border-rose-500/20';
}

export default function Badge({ value, children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${badgeTone(value)} ${className}`}>
      {children ?? value}
    </span>
  );
}
