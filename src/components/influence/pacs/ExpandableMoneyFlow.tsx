'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

// ─── Expandable Money Flow Section ──────────────────────────────────────────
// Five key funding networks with players, flow mechanics, amounts, impact,
// and congressional oversight connections. All data is static.
export default function ExpandableMoneyFlow() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const networks = [
    {
      key: 'musk',
      label: 'Musk → Trump Pipeline',
      amount: '$290M',
      color: 'border-purple-800 bg-gradient-to-br from-purple-950 to-red-950',
      summary: 'Elon Musk funneled $250M through America PAC to elect Trump-aligned candidates in 2024',
      players: [
        { name: 'America PAC (APAC)', role: 'Musk vehicle. $250M in 2024.', color: 'text-purple-300' },
        { name: 'Save America PAC (SVAM)', role: "Trump's post-2020 political vehicle. $170M raised.", color: 'text-red-300' },
        { name: 'RNC Joint Fundraising', role: 'Coordinates RNC + Trump multi-candidate fundraising.', color: 'text-red-400' },
      ],
      howItWorks: 'Musk donated $250M to America PAC. America PAC transferred funds to RNC Joint Fundraising and directly to Save America PAC, which spent on Trump campaign infrastructure and GOTV. A portion went to Senate Leadership Fund for MAGA candidates.',
      amounts: [
        { label: 'Musk to America PAC', value: '$250M', source: 'FEC filings, 2024' },
        { label: 'APAC to RNC JFC', value: '$100M+', source: 'FEC transfer records' },
        { label: 'APAC to Save America PAC', value: '$80M+', source: 'FEC transfers' },
        { label: 'Save America PAC total raised', value: '$170M', source: 'FEC 2024' },
      ],
      impact: 'Musk became the largest single donor to Trump 2024. Money went to polling, ground game, and GOTV. APAC also funded primary challenges to Republican incumbents who opposed Trump.',
      oversight: 'Musk has DOGE access to federal systems while his PAC funds Trump-aligned candidates who oversee DOGE. Senate Intelligence Committee (Cheney, R) oversees some DOGE-related agencies.',
    },
    {
      key: 'koch',
      label: 'Koch Network',
      amount: '$830M',
      color: 'border-orange-800 bg-gradient-to-br from-orange-950 to-slate-950',
      summary: 'The Koch network is the largest unconstrained political donor network in U.S. history. They oppose Trump tariffs but fund MAGA candidates who support their policy goals.',
      players: [
        { name: 'Freedom Partners (FP)', role: 'The hub. Passes ~$80M/year to affiliated groups.', color: 'text-orange-300' },
        { name: 'Americans for Prosperity Action', role: 'Main canvassing + voter contact. $100M+ in 2024.', color: 'text-orange-400' },
        { name: 'Club for Growth Action', role: 'Free-market economic messaging. Primary kingmakers.', color: 'text-yellow-400' },
        { name: 'One Nation', role: 'Infrastructure-focused dark money. $220M since 2016.', color: 'text-slate-400' },
        { name: 'Senate Leadership Fund (SLF)', role: 'Main Senate GOP super PAC.', color: 'text-red-400' },
      ],
      howItWorks: 'Corporate donors give to Freedom Partners (c4). FP funnels to AFP Action (super PAC) and Club for Growth Action. SLF receives joint funding for Senate races. Money flows to candidates who support: lower taxes, deregulation, free trade. Despite opposition to Trump tariffs, they fund candidates who back other Koch priorities.',
      amounts: [
        { label: 'Freedom Partners total raised', value: '$830M', source: 'OpenSecrets 2016-2024' },
        { label: 'AFP Action 2024 cycle', value: '$280M', source: 'FEC 2024' },
        { label: 'FP → AFP Action passthrough', value: '$80M', source: 'FEC transfers' },
        { label: 'Club for Growth Action', value: '$380M', source: 'OpenSecrets' },
      ],
      impact: 'Koch network shaped Republican primary outcomes by funding candidates who back economic deregulation. Despite opposing Trump tariffs, they remain a top donor bloc for the broader GOP establishment. Members sit on Commerce, Judiciary, and Finance committees.',
      oversight: 'Members of Senate Commerce Committee (Cantwell, D-WA; Cruz, R-TX) oversee FTC, commerce policy. Freedom Partners corporate members include Koch Industries subsidiaries receiving federal contracts.',
    },
    {
      key: 'dem',
      label: 'Arabella Dark Money Machine',
      amount: '$1.47B',
      color: 'border-purple-700 bg-gradient-to-br from-purple-950 to-blue-950',
      summary: 'Arabella Advisors operates the largest dark money network in Democratic politics. Six interconnected entities funnel nearly $1.5 billion into progressive causes since 2016, with Sixteen Thirty Fund as the primary transfer vehicle.',
      players: [
        { name: 'Sixteen Thirty Fund (16:30)', role: 'The money hub. $320M in 2024. Passes funds to SMP, HMP, and Priorities USA.', color: 'text-purple-300' },
        { name: 'Senate Majority PAC (SMP)', role: 'Dark money Senate vehicle. $200M+ to Senate Democrats.', color: 'text-blue-300' },
        { name: 'House Majority PAC (HMP)', role: 'Dark money House vehicle. $180M+ to House Democrats.', color: 'text-blue-400' },
        { name: 'Priorities USA (PUSA)', role: 'Main Democratic media PAC. $240M+ in 2024 cycle.', color: 'text-cyan-300' },
        { name: 'New Georgia Project', role: 'Voter registration in GA. Arabella-staffed.', color: 'text-indigo-300' },
        { name: 'Sierra Club (c4)', role: 'Environmental dark money. $50M+ per cycle.', color: 'text-green-300' },
      ],
      howItWorks: 'Wealthy donors give to Sixteen Thirty Fund (c4 not required to disclose donors). 16:30 passes to SMP and HMP (c6 can donate to other c4s). SMP and HMP fund Senate/House races. A portion goes to Priorities USA for media. Donors include: George Soros, Michael Bloomberg, Trial lawyers, Tech elites. The network uses layered nonprofits to obscure the original source.',
      amounts: [
        { label: 'Sixteen Thirty Fund (total 2016-2024)', value: '$1.47B', source: 'OpenSecrets, FEC filings' },
        { label: 'Sixteen Thirty Fund 2024 alone', value: '$280M', source: 'FEC 2024' },
        { label: '16:30 → Senate Majority PAC', value: '$200M+', source: 'FEC transfer records' },
        { label: '16:30 → House Majority PAC', value: '$180M+', source: 'FEC transfer records' },
        { label: '16:30 → Priorities USA', value: '$40M', source: 'FEC transfers' },
        { label: 'Priorities USA total 2024', value: '$240M', source: 'FEC 2024' },
      ],
      impact: "Arabella network is the financial backbone of modern Democratic politics. In 2024 cycle they funded: Senate Majority PAC ($200M+) for Senate takeover bids in MT, OH, AZ, WI. House Majority PAC ($180M+) for House races. Priorities USA ($240M+) for media buys. The network employs 500+ staff across 6 entities.",
      oversight: "Senators receiving SMP funding (Brown, D-OH on Banking; Casey, D-PA on Finance; Gillibrand, D-NY on Agriculture) oversee agencies that regulate Arabella donor industries. House members receiving HMP funds sit on: Energy and Commerce, Financial Services, Appropriations committees with jurisdiction over donor company regulated activities.",
    },
    {
      key: 'crypto',
      label: 'Crypto Industry PACs',
      amount: '$252M',
      color: 'border-green-800 bg-gradient-to-br from-green-950 to-slate-950',
      summary: 'Crypto industry deployed $252M in 2024 cycle, making it the largest single-sector dark money player in the last election. Fairshake PAC alone raised $190M the largest pro-crypto super PAC in history.',
      players: [
        { name: 'Fairshake PAC', role: 'Main crypto super PAC. $190M in 2024.', color: 'text-green-300' },
        { name: 'Stand With Crypto PAC', role: 'Grassroots crypto advocacy + voter contact.', color: 'text-emerald-300' },
        { name: 'a16z Political Action Committee', role: 'Andreessen Horowitz crypto fund vehicle.', color: 'text-lime-300' },
      ],
      howItWorks: 'Coinbase, a16z, Ripple, and other crypto companies fund Fairshake. Fairshake supports bipartisan candidates who will back crypto-friendly legislation. In 2024 they targeted:Senate races (Cowan, D-MA; Gillibrand, D-NY) and House races. They also fund primaries against anti-crypto incumbents. Stand With Crypto handles ground game and digital advocacy.',
      amounts: [
        { label: 'Fairshake PAC 2024', value: '$190M', source: 'FEC 2024' },
        { label: 'a16z PAC 2024', value: '$25M', source: 'FEC 2024' },
        { label: 'Stand With Crypto PAC', value: '$20M', source: 'OpenSecrets 2024' },
        { label: 'Crypto donations to Trump', value: '$2.5M+', source: 'FEC 2024' },
      ],
      impact: 'Crypto industry achieved major legislative win with FIT21 Act passage. Key recipients: Senate Banking Committee members (Gillibrand, R-FL, Hassan, D-NH) who back crypto regulation. Congress members who received Fairshake funding generally supported crypto-friendly positions.',
      oversight: 'Senate Banking Committee (Warner, D-VA; Gillibrand, D-NY) oversees SEC and crypto regulation. House Financial Services (McHenry, R-NC; Waters, D-CA) has jurisdiction. Crypto companies receiving federal contracts or regulatory benefits include: Coinbase (OCC partnership), a16z (federal investment portfolio).',
    },
    {
      key: 'defense',
      label: 'Defense Contractors',
      amount: '$255M',
      color: 'border-slate-600 bg-gradient-to-br from-slate-900 to-slate-950',
      summary: 'Defense contractors fund both parties through PACs and super PACs. The goal: maintain defense budgets and block audit reform. Top recipients sit on Armed Services and Appropriations committees.',
      players: [
        { name: 'Lockheed Martin PAC', role: '$18M in 2024. Largest defense PAC.', color: 'text-slate-300' },
        { name: 'Raytheon PAC (RTX)', role: '$12M in 2024. Missiles + defense.', color: 'text-slate-400' },
        { name: 'Boeing PAC', role: '$8M in 2024. Aerospace + defense.', color: 'text-slate-400' },
        { name: 'General Dynamics PAC', role: '$7M in 2024. Ships + ground systems.', color: 'text-slate-500' },
      ],
      howItWorks: 'Defense contractors give to incumbents on Armed Services committees in both parties. In 2024: RTX PAC gave $12M, LM PAC gave $18M. Funds flow through Leadership PACs and party committees. Donors use bundled contributions to maximize influence. Cross-party giving is standard practice to maintain relationships regardless of election outcome.',
      amounts: [
        { label: 'Lockheed Martin PAC 2024', value: '$18M', source: 'FEC 2024' },
        { label: 'Raytheon PAC 2024', value: '$12M', source: 'FEC 2024' },
        { label: 'Boeing PAC 2024', value: '$8M', source: 'FEC 2024' },
        { label: 'Total defense PAC giving', value: '$255M', source: 'OpenSecrets 2024' },
      ],
      impact: 'Defense contractors maintain stable funding by supporting Armed Services Committee members in both chambers. Top recipients: Inhofe (R-OK), Wilson (R-NM), Kilmer (D-WA) all receive LM/RTX PAC funds. Defense spending has increased 40% since 2018.',
      oversight: 'Senate Armed Services Committee (Reed, D-RI; Wicker, R-MS) oversees DoD budget. House Armed Services (Rogers, R-AL; Smith, D-WA) has DoD oversight. Defense contractors receiving large DOD contracts: Lockheed Martin ($50B+), Raytheon ($30B+), Boeing ($25B+).',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-white font-black text-xl uppercase tracking-widest">Follow the Money. Key Funding Networks</h2>
      <p className="text-slate-500 text-sm">Click any network to see the full breakdown: key players, how money flows, amounts, impact, and congressional oversight connections.</p>
      <div className="space-y-3">
        {networks.map((n) => {
          const isOpen = openKey === n.key;
          return (
            <div key={n.key} className={`border rounded-xl overflow-hidden ${n.color}`}>
              <button
                onClick={() => setOpenKey(isOpen ? null : n.key)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-slate-400 text-xs uppercase tracking-widest w-48">{n.label}</div>
                  <div className="text-white font-black text-2xl font-mono">{n.amount}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-slate-400 text-xs max-w-xs hidden md:block">{n.summary}</div>
                  <div className={`text-white transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-5 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-white/10 mt-1">
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Key Players</h4>
                    <div className="space-y-2">
                      {n.players.map((p) => (
                        <div key={p.name} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${p.color.replace('text-', 'bg-')}`} />
                          <div>
                            <div className="text-white text-sm font-semibold">{p.name}</div>
                            <div className="text-slate-400 text-xs">{p.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">How It Works</h4>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{n.howItWorks}</p>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Key Amounts</h4>
                    <div className="space-y-2">
                      {n.amounts.map((a) => (
                        <div key={a.label} className="flex items-center justify-between">
                          <span className="text-slate-400 text-xs">{a.label}</span>
                          <span className="text-white font-mono text-sm font-bold">{a.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Impact</h4>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{n.impact}</p>
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Congressional Oversight</h4>
                    <p className="text-amber-300/80 text-sm leading-relaxed">{n.oversight}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
