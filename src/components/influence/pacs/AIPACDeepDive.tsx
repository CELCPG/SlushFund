'use client';
import { useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Landmark, ChevronDown, ChevronUp } from 'lucide-react';
import { PAC_DATABASE } from '@/lib/pac-data';

// ─── AIPAC Deep Dive — Pro-Israel Money Empire ────────────────────────────────
// Five section tabs covering money, strategy, top races, top recipients, history.
export default function AIPACDeepDive() {
  const [openSection, setOpenSection] = useState<string | null>('overview');

  const sections = [
    {
      key: 'overview',
      label: 'The Money Empire',
      icon: <DollarSign size={13} />,
      color: 'text-blue-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total tracked spending', value: '$548M', sub: '2025–2026 cycle', color: 'text-white' },
              { label: 'Members funded', value: '512 of 535', sub: '96% of Congress', color: 'text-emerald-400' },
              { label: 'Direct PAC donations', value: '$0', sub: 'Via super PAC arm only', color: 'text-slate-400' },
              { label: 'Bipartisan split', value: '68% D / 32% R', sub: '$359M vs $171M', color: 'text-cyan-400' },
            ].map((s) => (
              <div key={s.label} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
                <div className="text-slate-600 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">The Network — Four Connected Vehicles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { abbr: 'AIPAC PAC', name: 'American Israel Public Affairs Committee PAC', role: 'Direct PAC contributions to candidates', raised: '$85M (2024 cycle)', type: 'PAC', color: '#3b82f6' },
                { abbr: 'UDP', name: 'United Democracy Project', role: 'Super PAC — unlimited independent expenditures', raised: '$87M (2024 cycle)', type: 'Super PAC', color: '#06b6d4' },
                { abbr: 'DMFI', name: 'Democratic Majority for Israel', role: 'Pro-Israel Democratic spending arm', raised: '$32M (2024 cycle)', type: 'Super PAC', color: '#8b5cf6' },
                { abbr: 'RJC', name: 'Republican Jewish Coalition', role: 'Pro-Israel Republican spending arm', raised: '$28M (2024 cycle)', type: 'Super PAC', color: '#f97316' },
              ].map((p) => (
                <div key={p.abbr} className="bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-white font-bold text-sm">{p.abbr}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${p.type === 'Super PAC' ? 'bg-purple-900/30 border-purple-700/50 text-purple-300' : 'bg-blue-900/30 border-blue-700/50 text-blue-300'}`}>{p.type}</span>
                    </div>
                    <span className={`text-xs font-mono ${p.color}`}>{p.raised}</span>
                  </div>
                  <div className="text-slate-400 text-xs mb-1">{p.name}</div>
                  <div className="text-slate-500 text-xs">{p.role}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg px-4 py-3">
            <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Bipartisan strategy</div>
            <p className="text-slate-300 text-sm">By funding members of both parties, AIPAC ensures pro-Israel legislation gets overwhelming support regardless of which party controls Congress. The 68/32 split toward Democrats reflects their institutional strength in the House — but the $171M to Republicans signals growing GOP alignment with Israel under Trump.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'udp',
      label: 'United Democracy Project',
      icon: <TrendingUp size={13} />,
      color: 'text-cyan-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'UDP raised 2024', value: '$87M', color: 'text-white' },
              { label: 'UDP disbursed total', value: '$61M', sub: 'incl. ~$8.6M to other PACs', color: 'text-cyan-400' },
              { label: 'Top disclosed donor', value: '$5M', sub: 'Jan Koum (WhatsApp co-founder)', color: 'text-purple-300' },
              { label: 'House independent expenditures', value: '$37.9M', sub: 'mostly progressive Dem primaries', color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
                {s.sub && <div className="text-slate-600 text-xs">{s.sub}</div>}
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">UDP's Most-Targeted 2024 Primary Races</h4>
            <div className="space-y-2">
              {[
                { name: 'Jamaal Bowman (NY-16)', amount: '$9.9M spent AGAINST', result: 'Lost the Democratic primary to George Latimer', color: 'text-red-400' },
                { name: 'Cori Bush (MO-1)', amount: '$5.2M spent AGAINST', result: 'Lost the Democratic primary to Wesley Bell', color: 'text-red-400' },
                { name: 'Dave Min (CA-47)', amount: '$4.6M spent AGAINST', result: 'Won the primary and general despite UDP opposition', color: 'text-emerald-400' },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.result}</div>
                  </div>
                  <div className={`font-mono font-bold text-xs ml-4 ${r.color}`}>{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-purple-950/20 border border-purple-900/30 rounded-lg px-4 py-3">
            <div className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">UDP strategy — "primary the left"</div>
            <p className="text-slate-300 text-sm">UDP's core tactic is unique in American politics: instead of simply backing friends, AIPAC runs aggressive opposition research ads against progressive candidates critical of Israeli government policy. In 2024, this "primary the left" strategy was the defining feature of AIPAC's political operation — spending tens of millions to defeat Squad members and their allies.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'ie',
      label: 'Independent Expenditures by Race',
      icon: <AlertTriangle size={13} />,
      color: 'text-red-300',
      content: (() => {
        const udp = PAC_DATABASE.find((p) => p.abbr === 'UDP');
        const ies = [...(udp?.independent_expenditures ?? [])].sort((a, b) => b.amount - a.amount);
        const oppose = ies.filter((e) => e.support_or_oppose === 'oppose').reduce((s, e) => s + e.amount, 0);
        const support = ies.filter((e) => e.support_or_oppose === 'support').reduce((s, e) => s + e.amount, 0);
        const fmt = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
        return (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Independent expenditures are unlimited sums a super PAC spends FOR or AGAINST a
              candidate without coordinating with their campaign. UDP's 2024 IE record shows the
              mechanics of AIPAC's "primary the left" strategy race by race.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total IE tracked', value: fmt(oppose + support), color: 'text-white' },
                { label: 'Spent opposing', value: fmt(oppose), color: 'text-red-400' },
                { label: 'Spent supporting', value: fmt(support), color: 'text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                  <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-slate-400 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-widest border-b border-white/10">
                    <th className="text-left py-2 pr-3">Race</th>
                    <th className="text-left py-2 pr-3">Candidate</th>
                    <th className="text-left py-2 pr-3">For / Against</th>
                    <th className="text-right py-2 pr-3">Amount</th>
                    <th className="text-left py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {ies.map((e, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-mono text-slate-300">{e.race}</td>
                      <td className="py-2 pr-3 text-white">{e.candidate}</td>
                      <td className="py-2 pr-3">
                        <span className={e.support_or_oppose === 'oppose' ? 'text-red-400 text-xs font-bold uppercase' : 'text-emerald-400 text-xs font-bold uppercase'}>
                          {e.support_or_oppose === 'oppose' ? 'Against' : 'For'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-bold text-white">{fmt(e.amount)}</td>
                      <td className="py-2 text-slate-400 text-xs">{e.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {udp?.source_urls && udp.source_urls.length > 0 && (
              <div className="text-slate-500 text-xs">
                <span className="uppercase tracking-widest text-slate-600">Sources: </span>
                {udp.source_urls.map((u, i) => (
                  <span key={u}>
                    {i > 0 && ' · '}
                    <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {new URL(u).hostname.replace('www.', '')}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })(),
    },
    {
      key: 'congress',
      label: 'Top Congressional Recipients',
      icon: <Landmark size={13} />,
      color: 'text-emerald-300',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Top 10 Recipients — 2025–2026 Cycle</h4>
            <div className="space-y-2">
              {[
                { rank: '#1', name: 'George Latimer (D-NY)', chamber: 'House', amount: '$22.7M', color: 'text-emerald-400', note: 'Defeated AOC in primary — single largest AIPAC investment ever' },
                { rank: '#2', name: 'Wesley Bell (D-MO)', chamber: 'House', amount: '$16.9M', color: 'text-emerald-400', note: 'Defeated Cori Bush in August 2024 primary' },
                { rank: '#3', name: 'Adam Schiff (D-CA)', chamber: 'Senate', amount: '$9.6M', color: 'text-blue-400', note: 'Took AIPAC money then became Senate Majority Leader' },
                { rank: '#4', name: 'Haley Stevens (D-MI)', chamber: 'House', amount: '$9.1M', color: 'text-blue-400', note: 'Challenger to Andy Levin — won with heavy AIPAC support' },
                { rank: '#5', name: 'Glenn Ivey (D-MD)', chamber: 'House', amount: '$8.2M', color: 'text-blue-400', note: 'Primary opponent to progressive candidate' },
                { rank: '#6', name: 'Jacky Rosen (D-NV)', chamber: 'Senate', amount: '$7.6M', color: 'text-blue-400', note: 'GOP target — critical Senate race' },
                { rank: '#7', name: 'Josh Gottheimer (D-NJ)', chamber: 'House', amount: '$6.7M', color: 'text-blue-400', note: 'Co-chair New Dems — bipartisanship champion' },
                { rank: '#8', name: 'Brad Schneider (D-IL)', chamber: 'House', amount: '$6.7M', color: 'text-blue-400', note: 'Targeted by Squad in 2022 — survived' },
                { rank: '#9', name: 'Shontel Brown (D-OH)', chamber: 'House', amount: '$6.6M', color: 'text-blue-400', note: 'Defeated Nina Turner in 2022 primary — AIPAC bet paid off' },
                { rank: '#10', name: 'Chuck Schumer (D-NY)', chamber: 'Senate', amount: '$6.5M', color: 'text-blue-400', note: 'Senate Majority Leader — AIPAC\'s most important ally' },
              ].map((r) => (
                <div key={r.name} className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <span className="text-slate-600 font-mono text-xs w-6 shrink-0">{r.rank}</span>
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.note}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className={`font-mono font-bold text-sm ${r.color}`}>{r.amount}</div>
                    <div className="text-slate-600 text-xs">{r.chamber}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Top Republican Recipients</h4>
            <div className="space-y-2">
              {[
                { name: 'Ted Cruz (R-TX)', amount: '$6.1M', color: 'text-orange-400', note: 'Senate Foreign Relations Committee' },
                { name: 'Lindsey Graham (R-SC)', amount: '$4.6M', color: 'text-orange-400', note: 'Senate Armed Services Committee' },
                { name: 'Elissa Slotkin (D-MI)', amount: '$4.5M', color: 'text-blue-400', note: 'Defense industry background — Armed Services' },
                { name: 'Jon Ossoff (D-GA)', amount: '$5.3M', color: 'text-blue-400', note: 'Senate Foreign Relations Committee' },
                { name: 'Cory Booker (D-NJ)', amount: '$5.8M', color: 'text-blue-400', note: 'Foreign Affairs Committee' },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.note}</div>
                  </div>
                  <div className={`font-mono font-bold text-sm text-right ${r.color}`}>{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'strategy',
      label: 'Historical Growth & Strategy',
      icon: <TrendingUp size={13} />,
      color: 'text-amber-300',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">AIPAC Spending Growth — Election Cycle by Cycle</h4>
            <div className="space-y-2">
              {[
                { cycle: '2016', total: '$30M', breakdown: 'Traditional bipartisan PAC model', color: 'text-slate-400' },
                { cycle: '2018', total: '$35M', breakdown: 'Intensified Senate/House targeting', color: 'text-slate-400' },
                { cycle: '2020', total: '$55M', breakdown: 'Major pro-Israel messaging after Gaza conflicts', color: 'text-slate-400' },
                { cycle: '2022', total: '$80M', breakdown: 'UDP launched — $50M for primaries + general', color: 'text-blue-400' },
                { cycle: '2024', total: '$126.9M', breakdown: 'Record cycle: ~$55M AIPAC PAC + ~$61M UDP super PAC', color: 'text-emerald-400' },
                { cycle: '2025–26', total: '$548M', breakdown: 'All-in with affiliates — tracked by gen-us.space', color: 'text-cyan-400' },
              ].map((r) => (
                <div key={r.cycle} className="flex items-center gap-4 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <span className="text-slate-400 font-mono text-sm font-bold w-16 shrink-0">{r.cycle}</span>
                  <span className={`font-mono font-bold text-white w-20 shrink-0`}>{r.total}</span>
                  <span className={`text-xs ${r.color}`}>{r.breakdown}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">Historical Strategy</h4>
              <div className="space-y-2 text-slate-400 text-xs">
                <p><span className="text-white">1963–2018: Coalition builder.</span> AIPAC built bipartisan consensus by funding members on both sides of the aisle. Its power came from constituent pressure, not just money — members feared AIPAC's voter mobilization and grass-roots infrastructure.</p>
                <p><span className="text-white">2019–2022: DMFI split.</span> Progressive Jewish donors broke away to form DMFI after AIPAC opposed the Iran nuclear deal. DMFI gave AIPAC's critics an institutional home within the pro-Israel tent.</p>
                <p><span className="text-white">2022–present: UDP super PAC escalation.</span> AIPAC realized it could weaponize unlimited money through a super PAC. UDP became the primary tool — disbursing roughly $61M in 2024 alongside $55M+ in traditional PAC contributions.</p>
              </div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">Key funders — UDP + AIPAC PAC</h4>
              <div className="space-y-2">
                {[
                  { name: 'Jan Koum', amount: '$5M', role: 'UDP — WhatsApp co-founder', color: 'text-cyan-300' },
                  { name: 'Jonathan Jacobson', amount: '$4.6M', role: 'UDP — hedge fund financier', color: 'text-cyan-300' },
                  { name: 'Bernard Marcus', amount: '$3M', role: 'UDP — Home Depot co-founder', color: 'text-cyan-300' },
                  { name: 'David Zalik', amount: '$2M', role: 'UDP — GreenSky CEO', color: 'text-cyan-300' },
                  { name: 'Haim Saban', amount: '$10M+', role: 'DMFI primary funder', color: 'text-blue-300' },
                ].map((f) => (
                  <div key={f.name} className="flex items-start justify-between">
                    <div className="text-slate-300 text-xs">{f.name}</div>
                    <div className={`text-xs font-mono font-bold text-right ${f.color}`}>{f.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-3">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-1">2026 cycle — What changed</div>
            <p className="text-slate-300 text-sm">The $548M tracked by gen-us.space for 2025–2026 represents a dramatic escalation — 4x the 2024 cycle total. This reflects UDP's full integration into AIPAC's political operation and the use of 501(c)(4) dark money vehicles for undisclosed portions of spending. The 96% member funding rate (512 of 535) is unmatched by any other PAC in US politics.</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap gap-2 mb-5">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              openSection === s.key ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
            }`}
          >
            <span className={s.color}>{s.icon}</span>
            {s.label}
            {openSection === s.key ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        ))}
      </div>

      {openSection && sections.find((s) => s.key === openSection) && (
        <div key={openSection}>{sections.find((s) => s.key === openSection)!.content}</div>
      )}

      {!openSection && <div>{sections[0].content}</div>}
    </div>
  );
}
