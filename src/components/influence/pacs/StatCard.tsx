// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-slate-400 text-xs uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}
