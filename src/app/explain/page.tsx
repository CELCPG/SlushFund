import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Network, BarChart3, DollarSign, Landmark, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How It All Works | SlushFund',
  description: 'An interactive explainer showing how congressional stock trading, federal contracting, and dark money PACs connect to create a corruption ecosystem.',
};

export default function ExplainPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-950/50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-3">
            <Search size={28} className="text-[#E63946]" />
            <h1 className="text-4xl font-black">How It All Works</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl">
            A visual guide to the hidden network connecting Congress, federal contracts, and dark money.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

        {/* Section 1: Congress Stock Trading */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
              <Landmark size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Congress Stock Trading</h2>
              <p className="text-slate-500 text-sm">They trade on insider knowledge. Legally.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'The STOCK Act (2012)',
                desc: 'Congress passed a law requiring them to publicly disclose stock trades within 45 days. They wrote the exemption themselves. For "delay and deference" to the executive branch.',
                color: 'blue',
              },
              {
                step: '2',
                title: 'Blind Trusts, Except Not',
                desc: "Members can place assets in \"blind trusts\" but there is no requirement to actually blind them. Many maintain full visibility while technically \"managing\" the trust.",
                color: 'blue',
              },
              {
                step: '3',
                title: 'Trading on Policy Knowledge',
                desc: 'Committee chairs know which defense contractors are about to get contracts. appropriators know which agencies are getting funded. They trade ahead of public announcements.',
                color: 'blue',
              },
            ].map(item => (
              <div key={item.step} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
                <div className="w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-black flex items-center justify-center mb-3">{item.step}</div>
                <div className="text-white font-semibold text-sm mb-2">{item.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-950/20 border border-blue-900/30 rounded-xl p-4 flex items-start gap-3">
            <BarChart3 size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-blue-300 text-xs leading-relaxed">
              <strong>On SlushFund:</strong> See every congressional trade with company disclosures, sector analysis, and overlap with federal contractors. Filter by committee, party, or company.{' '}
              <Link href="/congress/trades" className="underline hover:text-white">View all trades -&gt;</Link>
            </p>
          </div>
        </section>

        {/* Section 2: Federal Contracting */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-900/40 border border-orange-700/40 flex items-center justify-center">
              <DollarSign size={20} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Federal Contracting</h2>
              <p className="text-slate-500 text-sm">Where billions flow, and conflicts follow.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'No-Bid Contracts',
                desc: "Under \"sole source\" or \"no bid\" rules, agencies can award contracts without competitive bidding. DOD uses this for classified programs. Sometimes it's abuse, sometimes it's by design.",
                color: 'orange',
              },
              {
                step: '2',
                title: 'The Revolving Door',
                desc: 'Defense contractors hire retired generals and ex-Congressional staffers as consultants and executives. The contractors get insider access; the officials get cushy jobs after leaving.',
                color: 'orange',
              },
              {
                step: '3',
                title: 'Politicians Own the Contractors',
                desc: 'Members of the Armed Services Committee directly own stock in the contractors they oversee. They vote on budgets for companies they have financial stakes in. No recusal requirements.',
                color: 'orange',
              },
            ].map(item => (
              <div key={item.step} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
                <div className="w-7 h-7 rounded-full bg-orange-900/40 text-orange-400 text-xs font-black flex items-center justify-center mb-3">{item.step}</div>
                <div className="text-white font-semibold text-sm mb-2">{item.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-orange-950/20 border border-orange-900/30 rounded-xl p-4 flex items-start gap-3">
            <BarChart3 size={16} className="text-orange-400 mt-0.5 shrink-0" />
            <p className="text-orange-300 text-xs leading-relaxed">
              <strong>On SlushFund:</strong> Browse every federal contract. Find no-bid awards, see which contractors get the most, and track the overlap between congressional trades and contract awards.{' '}
              <Link href="/dashboard" className="underline hover:text-white">View spending -&gt;</Link>
            </p>
          </div>
        </section>

        {/* Section 3: Dark Money PACs */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center">
              <DollarSign size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Dark Money Super PACs</h2>
              <p className="text-slate-500 text-sm">Money that hides in plain sight.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: '501(c)(4) Dark Money',
                desc: 'Nonprofits can spend unlimited money on "social welfare" activities without disclosing donors. Groups like Arabella Advisors manage billions for anonymous clients, including politically motivated funding.',
                color: 'purple',
              },
              {
                step: '2',
                title: 'Super PACs',
                desc: "Super PACs can raise and spend unlimited funds, but must disclose donors. Still, shell companies and LLCs make tracing money back to its source difficult. America PAC (Trump's) raised $300M+.",
                color: 'purple',
              },
              {
                step: '3',
                title: 'The Donation Pipeline',
                desc: 'Dark money groups donate to Super PACs. Super PACs donate to candidates. Candidates vote for policies that benefit their donors. The public never sees the connection.',
                color: 'purple',
              },
            ].map(item => (
              <div key={item.step} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
                <div className="w-7 h-7 rounded-full bg-purple-900/40 text-purple-400 text-xs font-black flex items-center justify-center mb-3">{item.step}</div>
                <div className="text-white font-semibold text-sm mb-2">{item.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-purple-950/20 border border-purple-900/30 rounded-xl p-4 flex items-start gap-3">
            <BarChart3 size={16} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-purple-300 text-xs leading-relaxed">
              <strong>On SlushFund:</strong> See where dark money comes from and where it goes. Track PAC donations to candidates, visualize the funding network, and see which politicians are most connected to dark money.{' '}
              <Link href="/pacs" className="underline hover:text-white">View PAC data -&gt;</Link>
            </p>
          </div>
        </section>

        {/* The Connection Section */}
        <section className="py-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-700/40 rounded-2xl p-8 text-center">
            <Network size={36} className="text-[#E63946] mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-3">It All Connects</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
              Politicians vote on defense budgets for companies they own stock in. They get campaign donations from PACs funded by those same contractors. They serve on committees overseeing agencies that award contracts to their donors. It is a closed loop. And you can explore it.
            </p>
            <Link
              href="/explain/network"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#E63946] hover:bg-[#E63946]/90 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Explore the Network Graph
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* The Three-Way Connection */}
        <section>
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">The Loop</span>
            <span className="h-px flex-1 bg-slate-800" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Landmark size={20} />, color: 'blue', title: 'Congress Trades', desc: 'Members buy stock in contractors before public announcements. They know what\'s coming.', href: '/congress/trades', cta: 'See all trades' },
              { icon: <DollarSign size={20} />, color: 'orange', title: 'Contracts Flow', desc: 'Billions in no-bid awards go to those same contractors. Conflict of interest? Not legally.', href: '/dashboard', cta: 'Browse contracts' },
              { icon: <DollarSign size={20} />, color: 'purple', title: 'PACs Donate', desc: 'Dark money PACs fund the campaigns of members who approve budgets for their donors.', href: '/pacs', cta: 'View PAC network' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
                  <div className={`w-9 h-9 rounded-lg bg-${item.color}-900/30 border border-${item.color}-700/30 flex items-center justify-center mb-3 text-${item.color}-400`}>
                    {item.icon}
                  </div>
                  <div className="text-white font-bold text-sm mb-1">{item.title}</div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">{item.desc}</p>
                  <Link href={item.href} className="text-xs text-slate-300 hover:text-white underline">
                    {item.cta} -&gt;
                  </Link>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-slate-700">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}