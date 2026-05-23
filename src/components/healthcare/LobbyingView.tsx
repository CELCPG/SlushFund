'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Building2, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import rankedSectorsData from '@/data/opensecrets/ranked_sectors.json';
import industriesData from '@/data/opensecrets/industries.json';
import topSpendersData from '@/data/opensecrets/top_spenders.json';
import topRecipientsData from '@/data/opensecrets/top_recipients.json';

function parseUSD(s: string): number {
  return parseInt(s.replace(/[$,]/g, ''), 10);
}

const fmt = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};

const SECTOR_COLORS: Record<string, string> = {
  Health: '#10b981',
  'Finance/Insur/RealEst': '#3b82f6',
  'Communic/Electronics': '#8b5cf6',
  'Misc Business': '#64748b',
  'Energy/Nat Resource': '#f97316',
  Transportation: '#06b6d4',
  Other: '#475569',
  Agribusiness: '#84cc16',
  'Ideology/Single-Issue': '#ec4899',
  Defense: '#ef4444',
  Construction: '#a855f7',
  Labor: '#eab308',
  'Lawyers & Lobbyists': '#334155',
};

const PHARMA_SPENDERS = [
  'Pharmaceutical Research & Manufacturers of America',
  'Pfizer Inc',
  'Merck & Co',
  'Novartis AG',
  'Roche Holdings',
  'Eli Lilly',
  'Johnson & Johnson',
  'AbbVie Inc',
  'Bristol-Myers Squibb',
  'Amgen Inc',
  'Gilead Sciences',
  'Regeneron Pharmaceuticals',
  'Vertex Pharmaceuticals',
  'Moderna',
  'Biogen',
  'Illumina',
];

export default function LobbyingView() {
  const sectors = rankedSectorsData.data as Array<{ Sector: string; Total: string }>;
  const industries = industriesData.data as Array<{ Industry: string; Total: string }>;
  const topSpenders = topSpendersData.data as Array<{ 'Lobbying Client': string; 'Total Spent': string }>;
  const topRecipients = topRecipientsData.data as Array<{ Recipient: string; 'From Lobbyists': string; 'From Lobbyists + Family': string }>;

  const sectorChart = sectors.map((s) => ({
    name: s.Sector,
    value: parseUSD(s.Total),
  }));

  const healthIndustry = industries.find((i) => i.Industry === 'Pharmaceuticals/Health Products');
  const healthValue = healthIndustry ? parseUSD(healthIndustry.Total) : 0;

  const pharmaSpenders = topSpenders
    .filter((s) => PHARMA_SPENDERS.some((p) => s['Lobbying Client'].includes(p)))
    .map((s) => ({
      name: s['Lobbying Client'],
      value: parseUSD(s['Total Spent']),
    }));

  const totalHealth = sectors.find((s) => s.Sector === 'Health');
  const healthTotal = totalHealth ? parseUSD(totalHealth.Total) : 0;

  const pharmaLobbyingTotal = pharmaSpenders.reduce((s, p) => s + p.value, 0);

  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: '#e2e8f0' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-10">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          Pharma & Healthcare Lobbying
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          How much the pharmaceutical and healthcare industry spends to influence federal policy — and who in Congress receives the most lobby cash from these industries.
          Data sourced from OpenSecrets.org.
        </p>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Health Sector Lobbying"
          value={fmt(healthTotal)}
          sublabel="Total federal lobbying spend"
          icon={<Building2 size={14} />}
          accent="green"
        />
        <StatCard
          label="Pharma/Health Products"
          value={fmt(healthValue)}
          sublabel="Specific to pharma & health products"
          icon={<DollarSign size={14} />}
          accent="green"
        />
        <StatCard
          label="Top Pharma Lobbyers"
          value={fmt(pharmaLobbyingTotal)}
          sublabel="Top pharma company lobbying spend"
          icon={<DollarSign size={14} />}
          accent="amber"
        />
        <StatCard
          label="PhRMA Alone"
          value={fmt(12300000)}
          sublabel="Pharmaceutical Research & Manufacturers of America"
          icon={<DollarSign size={14} />}
          accent="red"
        />
      </section>

      {/* Sector comparison bar chart */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Ranked Sectors — Federal Lobbying Spend
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={sectorChart} layout="vertical" margin={{ left: 140, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={140} />
              <Tooltip formatter={(v) => fmt(v as number)} {...tooltipStyle} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top pharma company spenders */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Top Pharma Company Lobbying Spenders
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Lobbying Client</th>
                <th className="text-right px-4 py-3">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pharmaSpenders.map((s) => (
                <tr key={s.name} className="text-slate-300 hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-mono">{fmt(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top recipients */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Top Congress Members — Lobby Cash Received
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-right px-4 py-3">From Lobbyists</th>
                <th className="text-right px-4 py-3">+ Family</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {topRecipients.slice(0, 15).map((r) => (
                <tr key={r.Recipient} className="text-slate-300 hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{r.Recipient}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-mono">
                    {fmt(parseUSD(r['From Lobbyists']))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 font-mono">
                    {fmt(parseUSD(r['From Lobbyists + Family']))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}