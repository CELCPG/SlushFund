'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Landmark, DollarSign, TrendingUp, AlertTriangle, Scale } from 'lucide-react';
import { PAC_DATABASE } from '@/lib/pac-data';
import { fmtM } from './pacs/format';
import { StatCard } from './pacs/StatCard';
import ExpandableMoneyFlow from './pacs/ExpandableMoneyFlow';
import CategoryChart from './pacs/CategoryChart';
import TopRecipients from './pacs/TopRecipients';
import FunderWeb from './pacs/FunderWeb';
import WhiteHouseChart from './pacs/WhiteHouseChart';
import Pactable from './pacs/Pactable';

// Lazy-load the three heaviest sub-components. They sit below the fold or are
// inside their own disclosure sections, so deferring their JS to the client
// trims ~700 LOC of recharts/SVG from the initial /influence bundle.
const NetworkViz = dynamic(() => import('./pacs/NetworkViz'), { ssr: false });
const AIPACDeepDive = dynamic(() => import('./pacs/AIPACDeepDive'), { ssr: false });
const APACDeepDive = dynamic(() => import('./pacs/APACDeepDive'), { ssr: false });

// ─── Super PAC View (embedded in the Influence hub) ──────────────────────────
// Thin orchestrator. Heavy sub-components are split into /pacs/* files and the
// three largest are dynamically imported.
export default function PacsView() {
  const totalRaised = PAC_DATABASE.reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const total2024 = PAC_DATABASE.reduce((s, p) => s + p.raised_2024_cycle, 0);
  const darkMoney = PAC_DATABASE.filter((p) => p.type === 'dark_money').reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const connectedToTrump = PAC_DATABASE.filter((p) => ['trump_ally', 'republican'].includes(p.connected_to)).reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const connectedToDems = PAC_DATABASE.filter((p) => ['progressive', 'democrat', 'arabella'].includes(p.connected_to)).reduce((s, p) => s + p.total_raised_2016_2024, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium text-sm">PAC Money Flow</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 text-xs">2016–2024 cycle data</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={18} className="text-blue-400" />
            <span className="text-blue-400 text-sm font-mono uppercase tracking-widest">PAC / Super PAC / Dark Money Database</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">PAC Money Flow<span className="text-blue-400"> — 2016–2024</span></h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-3xl">
            Tracking $9.5B+ in political action committee spending — from Trump/Musk America PAC to Koch network dark money to Arabella Advisors-managed progressive funding pipelines. Mapping the full web of who funds American politics and where the money flows.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tracked" value={fmtM(totalRaised)} sub="2016–2024 across all PACs" icon={DollarSign} color="text-white" />
          <StatCard label="2024 Cycle Only" value={fmtM(total2024)} sub="Raised in current cycle" icon={TrendingUp} color="text-emerald-400" />
          <StatCard label="Dark Money" value={fmtM(darkMoney)} sub="Undisclosed source funding" icon={AlertTriangle} color="text-purple-400" />
          <StatCard label="GOP vs Dem Funding" value={`${fmtM(connectedToTrump)} vs ${fmtM(connectedToDems)}`} sub="GOP dark money vs Dem dark money" icon={Scale} color="text-amber-400" />
        </div>

        {/* PAC network visualization (lazy-loaded) */}
        <NetworkViz />

        <ExpandableMoneyFlow />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryChart />
          <div className="space-y-6">
            <TopRecipients />
            <FunderWeb />
          </div>
        </div>

        <WhiteHouseChart />

        {/* AIPAC Deep Dive (lazy-loaded) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-950 via-cyan-900 to-slate-900 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-white/10 text-white/80 border border-white/20 px-2 py-0.5 rounded uppercase">Pro-Israel Lobby · AIPAC</span>
                  <span className="text-xs text-slate-400">Founded 1963 · Active</span>
                </div>
                <h2 className="text-white font-black text-2xl mb-1">The AIPAC Money Empire</h2>
                <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">AIPAC and its affiliated network of super PACs spent $548M in the 2025–2026 cycle — funding 512 of 535 members of Congress. It is the most broadly bipartisan PAC operation in American politics, with a strategic split: 68% to Democrats, 32% to Republicans.</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-black text-3xl font-mono">$548M</div>
                <div className="text-slate-400 text-xs">tracked 2025–2026</div>
              </div>
            </div>
          </div>
          <AIPACDeepDive />
        </div>

        {/* APAC Deep Dive (lazy-loaded) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-950 via-red-950 to-slate-900 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-white/10 text-white/80 border border-white/20 px-2 py-0.5 rounded uppercase">America PAC · APAC</span>
                  <span className="text-xs text-slate-400">Founded May 2024 · Active</span>
                </div>
                <h2 className="text-white font-black text-2xl mb-1">The Musk-Trump Pipeline</h2>
                <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">America PAC was the single largest donor vehicle in the 2024 election cycle. $290M raised in under 6 months. $250M came from Elon Musk personally. Here is how that money moved through Washington.</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-black text-3xl font-mono">$290M</div>
                <div className="text-slate-400 text-xs">raised in 2024</div>
              </div>
            </div>
          </div>
          <APACDeepDive />
        </div>

        <Pactable pacs={PAC_DATABASE} />

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-widest">Data Sources & Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400 leading-relaxed">
            <div>
              <span className="text-slate-200 font-medium block mb-1">Data Sources</span>
              OpenSecrets.org, FEC.gov, Center for Responsive Politics (CRP), news investigations. Figures include PAC contributions, super PAC spending, dark money 501(c)(4) allocations, and joint fundraising splits. Some amounts are estimates based on disclosed donors.
            </div>
            <div>
              <span className="text-slate-200 font-medium block mb-1">Dark Money Tracking</span>
              Arabella Advisors network (Sixteen Thirty Fund, Hub Projects, Hopewell Fund, North Fund) identified through IRS Form 990 disclosures and CRP cross-referencing. Koch network identified through Freedom Partners' required 501(c)(4) disclosures.
            </div>
            <div>
              <span className="text-slate-200 font-medium block mb-1">Connection Classification</span>
              PACs classified by: primary funder identity, candidate endorsement patterns, FEC registration type, and organizational affiliation. "Connected_to" field reflects political alignment, not legal designation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
