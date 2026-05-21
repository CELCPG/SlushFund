import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About SlushFund — Our Mission & Methodology',
  description: "Learn how SlushFund tracks federal spending, identifies political connections, and flags conflicts of interest. Full transparency on our data sources and limitations.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-5xl font-black text-white mb-4">About SlushFund</h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            We track the money behind federal spending. Every contract, every donation, every conflict.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-16">

        {/* Mission */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Our Mission</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            SlushFund exists because the money behind federal spending is invisible to the public. Contracts worth billions are awarded to companies whose executives donate to the politicians who control the agencies writing the checks. Stock trades that precede contract announcements are disclosed 45 days later, long after the profit is locked in. PAC money flows through layers of dark money groups before reaching a candidate.
          </p>
          <p className="text-slate-300 leading-relaxed">
            We make that money visible. Every contract, every donation, every stock trade — connected, searchable, and surfaced in plain language.
          </p>
        </section>

        {/* What We Track */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">What We Track</h2>
          <div className="grid gap-4">
            {[
              { label: 'Federal Contracts', desc: 'Every contract award, grant, and loan from USAspending.gov. Includes contractor name, awarding agency, dollar amount, and whether it was competitively bid.' },
              { label: 'Congressional Stock Trades', desc: 'OGE Form 278-T disclosures for all members of Congress. Every reported purchase and sale of stock, filed within 45 days of the transaction.' },
              { label: 'PAC Money', desc: 'Federal PAC contributions from FEC filings. We track both disclosed donations and the dark money networks that layer through 501(c)(4) organizations.' },
              { label: 'DOGE Savings', desc: 'Contract cancellations and reduction claims from doge.gov, verified against actual USAspending.gov disbursements.' },
            ].map(item => (
              <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-bold mb-1">{item.label}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Methodology</h2>

          <h3 className="text-white font-bold text-lg mt-8 mb-3">Political Connection Flagging</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            We flag a contract as "politically connected" when one or more of these conditions are met:
          </p>
          <ul className="space-y-2 text-slate-400 text-sm">
            {[
              'A company executive or major shareholder donated to a member of Congress who sits on the committee that oversees the awarding agency',
              'A company political action committee (PAC) contributed to a politician who voted for legislation benefiting that company',
              'A company with active federal contracts donated to a dark money group that subsequently donated to a politician who controls the company\'s regulatory agency',
              'A politician purchased stock in a company within 90 days before that company received a contract from an agency under that politician\'s oversight committee',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">+</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <h3 className="text-white font-bold text-lg mt-8 mb-3">Insider Trading Signals</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            We flag trades with a "pre-award buy" signal when all of the following are true:
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">1.</span>
              <span className="text-slate-300">The transaction type is a BUY or PURCHASE</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">2.</span>
              <span className="text-slate-300">The company has received a federal contract of $10M or more</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">3.</span>
              <span className="text-slate-300">The contract was awarded within 30 days BEFORE or 60 days AFTER the trade date</span>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            Note: Pre-award buy signals are not indicators of illegality. They represent the overlap between a member\'s disclosed trading activity and publicly available contract data. The STOCK Act prohibits insider trading using nonpublic information. Public contract announcements are not nonpublic. However, the appearance of a pattern is worth independent investigation.
          </p>

          <h3 className="text-white font-bold text-lg mt-8 mb-3">Contractor Overlap Scoring</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            For each congress member in our database, we calculate an "overlap score" (0-100) based on:
          </p>
          <div className="space-y-3">
            {[
              { pct: 40, label: 'Companies with federal contracts the member has traded', desc: 'Tracked by cross-referencing member stock holdings against the full awards database' },
              { pct: 30, label: 'Companies whose PAC donated to the member', desc: 'Tracked via FEC PAC contribution filings linked to the member\'s disclosed donations' },
              { pct: 20, label: 'Member serves on committee overseeing agencies that award contracts to traded companies', desc: 'Tracked by mapping committee assignments (from congressional records) to awarding agencies' },
              { pct: 10, label: 'Timing: member traded within 60 days of a major contract announcement by a traded company', desc: 'Tracked via the pre-award buy signal above' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-12 text-right">
                  <span className="text-emerald-400 font-mono font-bold text-sm">{item.pct}%</span>
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{item.label}</div>
                  <div className="text-slate-500 text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Data Sources</h2>
          <div className="space-y-3">
            {[
              { source: 'USAspending.gov', data: 'Federal contract awards, grants, and loans. Updated daily via automated sync.', url: 'https://www.usaspending.gov' },
              { source: 'Office of Government Ethics (OGE)', data: 'Form 278-T congressional stock transaction disclosures. Updated within 48 hours of filing.', url: 'https://oge.gov' },
              { source: 'Federal Election Commission (FEC)', data: 'PAC registration, PAC contribution records, candidate committee finances.', url: 'https://www.fec.gov' },
              { source: 'QuiverQuant', data: 'Real-time congressional trade data aggregated from OGE disclosures. Used to supplement OGE filings.', url: 'https://www.quiverquant.com' },
              { source: 'OpenSecrets', data: 'PAC revenue, spending, and donor information for dark money research.', url: 'https://www.opensecrets.org' },
              { source: 'doge.gov', data: 'Official DOGE savings claims and contract cancellation data.', url: 'https://doge.gov' },
            ].map(item => (
              <div key={item.source} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-white font-bold">{item.source}</div>
                  <div className="text-slate-400 text-sm mt-0.5">{item.data}</div>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-sm hover:underline shrink-0">
                  Visit →
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Limitations */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Limitations</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            SlushFund is a data transparency tool, not a legal judgment. Our flags are signals, not verdicts. A pre-award buy signal means a trade occurred near a contract award — it does not mean the trade was based on nonpublic information.
          </p>
          <div className="space-y-3">
            {[
              { lim: 'STOCK Act gaps', desc: 'The STOCK Act requires disclosure within 45 days. Trades can occur and profits can be taken before the public knows about them. Our data is always at least 45 days behind real time.' },
              { lim: 'Dark money layering', desc: 'We track PAC contributions and 501(c)(4) spending when disclosed. Many donors to dark money groups are never publicly identified. We show what is knowable, not everything that exists.' },
              { lim: 'Options and derivatives', desc: 'Congress members are required to disclose stock options and derivatives. These are often reported in ways that make precise valuation difficult. We convert all amounts to a range based on the disclosed value.' },
              { lim: 'Pre-2019 trades', desc: 'Our congressional trading database begins in 2019. Earlier trades are not included.' },
              { lim: 'Spouse trades', desc: 'Trades made by a spouse or dependent child are sometimes reported under the member\'s name but the timing and amount may not reflect the member\'s personal decision-making.' },
            ].map(item => (
              <div key={item.lim} className="flex items-start gap-3">
                <span className="text-amber-400 font-bold mt-0.5">*</span>
                <div>
                  <span className="text-white font-semibold">{item.lim}: </span>
                  <span className="text-slate-400 text-sm">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Corrections Policy */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Corrections Policy</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            We make mistakes. When we do, we correct them visibly. If you find an error in our data — a misattributed contract, an incorrect donation amount, a missing trade — contact us and we will investigate and correct within 48 hours.
          </p>
          <p className="text-slate-300">
            Corrections are logged at the bottom of the relevant page with a timestamp and description of what was changed.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">Contact</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            We work with journalists, researchers, and watchdog organizations. If you are investigating federal spending, congressional stock trading, or political money flows, we want to hear from you.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Submit a Tip or Data Request
          </a>
        </section>
      </div>
    </div>
  );
}