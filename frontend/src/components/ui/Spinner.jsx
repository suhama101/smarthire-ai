export default function Spinner({ className = '' }) {
  return <div className={`h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500 ${className}`} />;
}
