'use client';

interface TimelineChartProps {
  data: Record<string, number> | undefined;
}

export default function TimelineChart({ data }: TimelineChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-slate-400 text-sm py-8 text-center border border-slate-800 rounded-lg">
        Quarterly data will appear after FY2020–2021 data is backfilled.
      </div>
    );
  }

  const entries = Object.entries(data).sort();
  const max = Math.max(...entries.map(([, v]) => v));

  return (
    <div className="space-y-2">
      {/* Chart */}
      <div className="flex items-end gap-2 h-48">
        {entries.map(([label, value]) => {
          const pct = max > 0 ? (value / max) * 100 : 0;
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end h-40">
                <div
                  className="bg-amber-500/80 rounded-t w-full min-h-[4px] hover:bg-amber-400 transition-colors relative group"
                  style={{ height: `${pct}%` }}
                  title={`${label}: $${(value / 1e9).toFixed(1)}B`}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-slate-400 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    ${(value / 1e9).toFixed(1)}B
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">{label}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
        <div className="w-3 h-3 bg-amber-500/80 rounded" />
        <span>COVID Obligations by Quarter (USD, billions)</span>
      </div>
    </div>
  );
}