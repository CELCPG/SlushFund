import type { Metadata } from 'next';
import Link from 'next/link';
import { FlagChip, MoneyChip } from '@/components/v2/MoneyChip';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import { DATASETS, type DatasetKey } from '@/lib/v2/datasets';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Where each SlushFund dataset comes from, what it covers, how rows trace to filings, and its known limits.',
};

// Anchors match the older SourceBar "Methodology →" links (#trades, #contracts, …); the
// datasets that have a full write-up link to it.
const SECTIONS: { id: string; title: string; keys: DatasetKey[]; full?: { href: string; label: string } }[] = [
  { id: 'trades', title: 'Stock trades', keys: ['house_trades', 'senate_trades'], full: { href: '/about/methodology/trades', label: 'Read the full method for stock trades' } },
  { id: 'contracts', title: 'Contracts', keys: ['contracts', 'contract_totals'], full: { href: '/about/methodology/contracts', label: 'Read the full method for contracts' } },
  { id: 'members', title: 'Members of Congress', keys: ['members'] },
  { id: 'campaign', title: 'Campaign money', keys: ['campaign'] },
  { id: 'lobbying', title: 'Lobbying', keys: ['lobbying'] },
];

const RULES = [
  { title: 'Official records only', text: 'Every figure comes from a government source: the House Clerk, the Senate, USAspending.gov, the FEC, congress.gov. No third-party aggregators, and nothing typed in by hand.' },
  { title: 'Every row traces to its filing', text: 'Each row keeps its source ID and a link to the original document. If a row has no filing link, it says so.' },
  { title: 'Ranges stay ranges', text: 'Stock trades are reported in dollar bands. We show the band as filed and never a midpoint or an invented total.' },
  { title: 'Late or missing data is shown, not hidden', text: 'A late feed turns amber and says since when. A feed that fails shows “unavailable” and no numbers, never a zero.' },
];

export default function MethodologyPage() {
  return (
    <SimplePage
      eyebrow="About the data"
      title="Methodology"
      dek="Official public records only, loaded by code, every row traceable to its source document. Each dataset has its own page saying what is loaded, what is left out, and what the numbers cannot tell you."
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {RULES.map((r) => (
            <Card key={r.title}>
              <h2 className="font-display text-[18px] font-extrabold leading-tight">{r.title}</h2>
              <p className="mt-2 text-[14.5px] text-muted">{r.text}</p>
            </Card>
          ))}
        </div>

        <Card as="section" className="scroll-mt-6">
          <h2 className="font-display text-[24px] font-extrabold">How to read our labels</h2>
          <p className="mt-2 max-w-[760px] text-[15px] leading-relaxed">
            <FlagChip /> marks a pattern a reader may want to look at, for example a trade in a company whose sector our hand-built map links to a committee the member sat on. It is a pattern, never an accusation: a sequence of events is not proof of wrongdoing, and we do not say it is.
          </p>
        </Card>

        <Card as="section" className="scroll-mt-6">
          <h2 id="signals" className="scroll-mt-6 font-display text-[24px] font-extrabold">Signal scores</h2>
          <div className="mt-2 max-w-[760px] space-y-2 text-[15px] leading-relaxed">
            <p>
              Signal score out of 100 from our method: committee seat +45, listed federal contractor +30, reported late +15, large position +10. A score is a prompt to look closer, not a finding.
              Scores are shown as bands (70 and up, 45&ndash;69, 20&ndash;44, under 20), never as labels about the member.
            </p>
            <p>
              <b>Committee seat:</b> the member held a seat on the committee on the trade date, per the congress-legislators record of the latest snapshot on or before that date, and our hand-built map links
              that committee to the company&rsquo;s sector. The map is ours, not a statement of the committee&rsquo;s jurisdiction. When a new Congress had not yet published committee rosters, the signal is
              not computed.
            </p>
            <p>
              <b>Listed federal contractor:</b> the company, through a recipient we link to it, had a listed award signed on or before the trade date. The listed set is contracts the agency coded not
              competed of at least $1 million, or any contract of at least $10 million, signed from 2023-10-01 (USAspending). Amounts are obligated to date on those awards, as of the awards load, not the
              amount at the trade. A &ldquo;no&rdquo; means no award in that set was signed between 2023-10-01 and the trade; trades before 2023-10-01 are not computed.
            </p>
            <p>
              <b>Reported late:</b> the first report was filed more than 45 days after the trade date shown in the filing. Lateness is not computed below the $1,000 reporting threshold, when the first report is not
              in our records, or when the dates as filed look inconsistent.
            </p>
          </div>
        </Card>

        {SECTIONS.map((sec) => (
          <Card as="section" key={sec.id} className="scroll-mt-6">
            <h2 id={sec.id} className="scroll-mt-6 font-display text-[24px] font-extrabold">{sec.title}</h2>
            <div className="mt-3 grid gap-4">
              {sec.keys.map((k) => {
                const d = DATASETS[k];
                return (
                  <div key={k}>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.moneyType && <MoneyChip type={d.moneyType} />}
                      <b>{d.label}</b>
                    </div>
                    <p className="mt-1.5 text-[15px]">{d.scope}.</p>
                    <p className="mt-1 text-[14px] text-muted">
                      Source: <a href={d.source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink hover:underline">{d.source.name} ↗</a> · Refresh: {d.cadence}
                    </p>
                    {d.caveat && <p className="mt-1 text-[14px] text-muted"><b className="text-ink">Known limit:</b> {d.caveat}</p>}
                  </div>
                );
              })}
            </div>
            {sec.full && (
              <p className="mt-4"><Link href={sec.full.href} className="font-semibold text-trades-ink hover:underline">{sec.full.label} →</Link></p>
            )}
          </Card>
        ))}

        <Card as="section" className="scroll-mt-6">
          <h2 id="tickers" className="scroll-mt-6 font-display text-[24px] font-extrabold">Company and ticker links</h2>
          <p className="mt-2 text-[15px]">How a federal contractor is linked to a publicly traded company, and why only confirmed matches are shown.</p>
          <p className="mt-4"><Link href="/about/methodology/tickers" className="font-semibold text-trades-ink hover:underline">Read the full method for ticker links →</Link></p>
        </Card>

        <p className="text-[14px] text-muted">
          Current freshness for each dataset is on the <Link href="/data/status" className="font-semibold text-trades-ink hover:underline">data status page</Link>. Changes to stories and data are in the <Link href="/about/corrections" className="font-semibold text-trades-ink hover:underline">corrections log</Link>.
        </p>
      </div>
    </SimplePage>
  );
}
