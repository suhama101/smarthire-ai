export default function Card({ children, className = '', header, footer }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#1A1A24] text-[#F1F1F3] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${className}`}>
      {header ? <div className="border-b border-white/10 px-6 py-4">{header}</div> : null}
      <div className="px-6 py-6">{children}</div>
      {footer ? <div className="border-t border-white/10 px-6 py-4">{footer}</div> : null}
    </section>
  );
}
