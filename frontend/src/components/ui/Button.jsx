export default function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_10px_30px_-12px_rgba(79,70,229,0.65)] hover:brightness-110',
    secondary: 'bg-[#1A1A24] text-[#F1F1F3] border border-white/10 hover:border-indigo-500/40 hover:bg-white/5',
    ghost: 'bg-transparent text-[#F1F1F3] hover:bg-white/5',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-medium transition duration-200 ease-in-out ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
