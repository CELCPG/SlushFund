import { fmtM } from './format';

// ─── Top Recipients ────────────────────────────────────────────────────────────
// Horizontal bar chart of top recipients of PAC money by office.
// Cycles are explicit so 2024 includes the Harris nominee total, not Biden.
const RECIPIENTS = [
  // 2024 cycle — highest-spend races
  { label: 'Donald Trump (WH, 2024)',     amount: 1_300_000_000, party: 'R', color: '#ef4444' },
  { label: 'Kamala Harris (WH, 2024)',    amount: 600_000_000,   party: 'D', color: '#3b82f6' },
  // 2020 cycle
  { label: 'Joe Biden (WH, 2020)',        amount: 650_000_000,   party: 'D', color: '#3b82f6' },
  // 2024 Senate races
  { label: 'Elissa Slotkin (Sen-MI, 2024)', amount: 25_000_000, party: 'D', color: '#3b82f6' },
  { label: 'Jon Ossoff (Sen-GA, 2024)',     amount: 22_000_000, party: 'D', color: '#3b82f6' },
  { label: 'Josh Hammer (Sen-FL, 2024)',    amount: 20_000_000, party: 'R', color: '#ef4444' },
  { label: 'Dave McCormick (Sen-PA, 2024)', amount: 18_000_000, party: 'R', color: '#ef4444' },
];

// ─── Top Recipients ────────────────────────────────────────────────────────────
// Horizontal bar chart of top recipients of PAC money by office.
export default function TopRecipients() {
  const recipientBars = RECIPIENTS;

  const maxAmt = Math.max(...recipientBars.map((r) => r.amount));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Top Recipients. White House + Senate</h3>
      <p className="text-slate-500 text-xs mb-4">By cycle. Top federal races ranked by total PAC + dark money support.</p>
      <div className="space-y-3">
        {recipientBars.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-right">
              <span className="text-slate-300 text-sm">{r.label}</span>
            </div>
            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.amount / maxAmt) * 100}%`, backgroundColor: r.color, opacity: 0.8 }}
              />
            </div>
            <div className="w-24 text-right">
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
