export default function Input({ label, error, className = '', ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-[#F1F1F3]">{label}</span> : null}
      <input
        className={`w-full rounded-[10px] border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition duration-200 ease-in-out placeholder:text-[#8B8B9E] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${className}`}
        {...props}
      />
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </label>
  );
}
