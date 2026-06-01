import { fmtM } from './format';

// ─── Top Recipients ────────────────────────────────────────────────────────────
// Horizontal bar chart of top recipients of PAC money by office.
export default function TopRecipients() {
  const recipientBars = [
    { label: 'Donald Trump (WH)', amount: 1_300_000_000, party: 'R', office: 'white_house', color: '#ef4444' },
    { label: 'Joe Biden (WH)', amount: 650_000_000, party: 'D', office: 'white_house', color: '#3b82f6' },
    { label: 'Elissa Slotkin (Sen-MI)', amount: 25_000_000, party: 'D', office: 'senate', color: '#3b82f6' },
    { label: 'Josh Hammer (Sen-FL)', amount: 20_000_000, party: 'R', office: 'senate', color: '#ef4444' },
    { label: 'Dave McCormick (Sen-PA)', amount: 18_000_000, party: 'R', office: 'senate', color: '#ef4444' },
    { label: 'Jon Ossoff (Sen-GA)', amount: 22_000_000, party: 'D', office: 'senate', color: '#3b82f6' },
  ];

  const maxAmt = Math.max(...recipientBars.map((r) => r.amount));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Recipients — White House + Senate</h3>
      <div className="space-y-3">
        {recipientBars.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-right">
              <span className="text-slate-300 text-sm">{r.label}</span>
            </div>
            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.amount / maxAmt) * 100}%`, backgroundColor: r.color, opacity: 0.8 }}
              />
            </div>
            <div className="w-28 text-right">
              <span className="text-white font-mono font-bold text-sm">{fmtM(r.amount)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Republican</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Democrat</div>
      </div>
    </div>
  );
}
