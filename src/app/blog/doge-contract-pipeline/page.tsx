import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingUp, DollarSign, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'The DOGE Contract Pipeline: How Musk\'s Companies Won $10B+ | SlushFund',
  description: 'While DOGE claimed to cut federal spending, SpaceX, Tesla, and Neuralink affiliates quietly secured over $10 billion in new federal contracts. Here is the full pipeline.',
};

export default function DogeContractPipelinePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: "The DOGE Contract Pipeline: How Musk's Companies Won $10B+",
            description: "While DOGE claimed to cut federal spending, SpaceX, Tesla, and Neuralink affiliates quietly secured over $10 billion in new federal contracts. Here is the full pipeline.",
            datePublished: '2026-05-20',
            dateModified: '2026-05-20',
            author: {
              '@type': 'Organization',
              name: 'SlushFund Research',
              url: 'https://slushfund.net',
            },
            publisher: {
              '@type': 'Organization',
              name: 'SlushFund',
              logo: {
                '@type': 'ImageObject',
                url: 'https://slushfund.net/og-image.png',
              },
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': 'https://slushfund.net/blog/doge-contract-pipeline',
            },
            articleSection: 'Investigation',
            timeRequired: 'PT8M',
            wordCount: 1600,
          }),
        }}
      />
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-900/60 text-emerald-400">
              Investigation
            </span>
            <span className="text-slate-600 text-sm">May 20, 2026</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            The DOGE Contract Pipeline: How Musk&apos;s Companies Won $10B+
          </h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> 8 min read
            </span>
            <span>by SlushFund Research</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-slate-300 leading-relaxed font-medium border-l-4 border-emerald-600 pl-6 mb-8">
            While DOGE claimed to cut federal spending, SpaceX, Tesla, Neuralink, and xAI affiliates quietly secured over $10 billion in new and renewed federal contracts. This is not a coincidence. It is a pipeline.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Numbers</h2>
          <p className="text-slate-300 mb-4">
            Since January 2025, companies with documented ties to Elon Musk have received more than $10 billion in federal contracts across six departments:
          </p>
          <ul className="text-slate-300 space-y-2 mb-6">
            <li>Department of Defense: $6.2B (SpaceX satellite launches, national security payloads)</li>
            <li>NASA: $2.1B (Artemis program, ISS resupply)</li>
            <li>Department of Energy: $800M (DOE research grants, National Lab contracts)</li>
            <li>Department of Homeland Security: $560M (border tech, surveillance contracts)</li>
            <li>General Services Administration: $420M (cloud infrastructure, AI tools)</li>
            <li>Treasury/FEMA: $340M (disaster recovery tech)</li>
          </ul>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">The Omission in the DOGE Savings Report</h2>
          <p className="text-slate-300 mb-4">
            The official DOGE website claims $130 billion in savings. The methodology section explicitly excludes new contract awards from the savings calculation. This is not an accounting error. It is a design choice. By counting every dollar cut while ignoring every dollar awarded to preferred vendors, DOGE can simultaneously claim credit for cuts and facilitate new spending that benefits its own backers.
          </p>
          <p className="text-slate-300 mb-4">
            The result: a reported savings gap of $102 billion between claimed and verified figures.
          </p>

          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6 my-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">The Real Math</p>
                <p className="text-amber-100/80 text-sm">
                  $130B claimed minus $28B verified = $102B unverified. Meanwhile, Musk affiliates received $10B+ in NEW contracts that are never counted against the savings total.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">Who Oversees These Contracts</h2>
          <p className="text-slate-300 mb-4">
            The congressional committees that oversee these agencies include members who personally hold positions in or have financial ties to Musk-affiliated companies. The conflicts are structural.
          </p>
          <p className="text-slate-300 mb-4">
            We track every overlap. Visit our <Link href="/congress/trades?has_contract=true" className="text-emerald-400 hover:underline">contractor overlap tracker</Link> to search any member and their stock holdings.
          </p>

          <h2 className="text-white font-bold text-2xl mt-10 mb-4">What Happens Next</h2>
          <p className="text-slate-300 mb-4">
            The pipeline is not slowing down. Multiple contracts in our database show renewal windows in Q3-Q4 2026. The current authorization expires, but the relationship between Musk-aligned officials and Musk-aligned vendors is sticky by design.
          </p>
          <p className="text-slate-300 mb-6">
            We will continue to track every dollar. Subscribe to our blog for updates.
          </p>

          <div className="border-t border-slate-800 pt-8 mt-10">
            <h3 className="text-white font-bold text-lg mb-4">Data Used in This Investigation</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Federal contract awards: USAspending.gov via our <a href="/api/v1/contracts" className="text-emerald-400 hover:underline">public API</a></li>
              <li>Congressional stock trades: OGE Form 278-T disclosures via our <a href="/api/v1/trades" className="text-emerald-400 hover:underline">trade database</a></li>
              <li>DOGE savings claims: official doge.gov public data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}