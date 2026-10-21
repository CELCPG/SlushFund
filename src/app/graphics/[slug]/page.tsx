import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import FilingLink from '@/components/v2/FilingLink';
import GraphicActions from '@/components/v2/graphics/GraphicActions';
import SceneSvg from '@/components/v2/graphics/SceneSvg';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { one, type SP } from '@/lib/v2/explorer';
import { GRADE_METHOD_PATH, GRAPHICS_PATH, MOST_ACTIVE_PATH, PRESIDENT_PATH, graphicEnabled, type GraphicSlug } from '@/lib/v2/flags';
import { fmtCount, fmtDate, fmtUsd } from '@/lib/v2/format';
import {
  GRADE_ORDER, getDelayGraphic, getFundingGraphic, getGradeGraphic, getPresidentGraphic,
  type DelayGraphic, type FundingGraphic, type GradeGraphic, type PresidentGraphic,
} from '@/lib/v2/graphics-data';
import { graphicBySlug } from '@/lib/v2/graphics-meta';
import { delayScene, fundingScene, gradeScene, presidentScene, type Scene } from '@/lib/v2/graphics-scene';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 1800;

// D20: one infographic per page. Behind graphicEnabled() (SHOW_INFOGRAPHICS plus the flag of the feature the figures come from).
// The hero graphic is one responsive SVG built from live rows; ?card=1 is the same graphic alone on a 1200x1200 canvas (the share card
// and the iframe embed). Every graphic prints its source, the retrieval date and its slushfund.net address inside the image.

export function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }): Promise<Metadata> {
  return (async () => {
    const { slug } = await params;
    const g = graphicBySlug(slug);
    if (!g || !graphicEnabled(slug)) return hiddenPageMetadata();
    const card = one((await searchParams).card) === '1';
    return pageMetadata({
      path: `${GRAPHICS_PATH}/${slug}`,
      title: g.title,
      description: g.blurb,
      card: 'own',
      robots: card || process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
    });
  })();
}

const th = 'py-2 pr-4 text-left text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';
const td = 'py-2 pr-4';
const link = 'font-semibold text-trades-ink underline-offset-2 hover:underline';
const pct1 = (share: number) => `${(share * 100).toFixed(1)}%`;

interface Built {
  scene: Scene;
  retrieved: string;
  caption: ReactNode;
  table: ReactNode;
  links: { href: string; label: string }[];
  method: ReactNode;
}

export default async function GraphicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const g = graphicBySlug(slug);
  if (!g || !graphicEnabled(slug)) notFound();
  const sp = await searchParams;
  const card = one(sp.card) === '1';
  const built = await build(g.slug);

  if (card) {
    return (
      <div data-gfx-card data-v2>
        {built ? (
          <SceneSvg scene={built.scene} id="gfx-svg" />
        ) : (
          <p className="p-8 text-[18px]">{g.title}: figures unavailable right now. The database did not answer.</p>
        )}
      </div>
    );
  }

  const url = `https://slushfund.net${GRAPHICS_PATH}/${slug}`;
  const embed = `<iframe src="${url}?card=1" title="${g.title.replace(/"/g, '&quot;')}" width="600" height="600" style="border:0;max-width:100%" loading="lazy"></iframe>`;

  return (
    <div data-v2 className="gfx-page">
      <PageBand className="gfx-hide-print">
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5"><Link href={GRAPHICS_PATH} className="hover:underline">Graphics</Link></p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{g.title}</h1>
        <p className="mt-3 max-w-[860px] text-[16px] text-on-deep max-md:text-[15px]">{g.blurb}</p>
      </PageBand>
      <Wrap className="pb-12">
        {g.datasets.length > 0 && <SourceBar datasets={g.datasets} className="gfx-hide-print mt-6" />}
        {!built ? (
          <section className="pt-6">
            <EmptyState title="This graphic is unavailable right now" tone="warning">
              The database did not answer, so no figures are shown. Try again in a few minutes.
            </EmptyState>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-[minmax(0,760px)_minmax(0,1fr)] items-start gap-8 pt-6 max-lg:grid-cols-1" aria-label="The graphic">
              <figure className="gfx-figure m-0 min-w-0">
                <SceneSvg scene={built.scene} id="gfx-svg" />
                <figcaption className="sr-only">{built.scene.label}</figcaption>
              </figure>
              <div className="min-w-0">
                <div className="space-y-3 text-[16px]" data-section="caption">{built.caption}</div>
                <p className="mt-3 text-[13px] text-muted">Data retrieved {fmtDate(built.retrieved)}. {built.method}</p>
                <div className="mt-5">
                  <GraphicActions svgId="gfx-svg" filename={`slushfund-${slug}.png`} embedCode={embed} cardHref={`${GRAPHICS_PATH}/${slug}?card=1`} />
                </div>
              </div>
            </section>
            <section className="gfx-hide-print pt-8" aria-labelledby="gfx-data">
              <Card>
                <SectionHead as="h2" title={<span id="gfx-data" className="text-[24px] max-md:text-[22px]">The data behind this</span>} sub="The numbers in the graphic, as a table, with the records they come from." />
                <div className="overflow-x-auto">{built.table}</div>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14.5px]">
                  {built.links.map((l) => (
                    <li key={l.href}>{/^https?:/.test(l.href) ? <a href={l.href} target="_blank" rel="noopener noreferrer" className={link}>{l.label} &#8599;</a> : <Link href={l.href} className={link}>{l.label}</Link>}</li>
                  ))}
                </ul>
              </Card>
            </section>
            <p className="gfx-hide-print mt-6 text-[13px] text-muted">
              More graphics: <Link href={GRAPHICS_PATH} className={link}>all graphics</Link>. This page&rsquo;s address: <span className="font-mono">{url}</span>
            </p>
          </>
        )}
      </Wrap>
    </div>
  );
}

async function build(slug: GraphicSlug): Promise<Built | null> {
  switch (slug) {
    case 'grading-congress': {
      const d = await getGradeGraphic();
      return d && buildGrade(d);
    }
    case 'where-the-money-comes-from': {
      const d = await getFundingGraphic();
      return d && buildFunding(d);
    }
    case 'trading-while-disclosing': {
      const d = await getDelayGraphic();
      return d && buildDelay(d);
    }
    case 'the-presidents-trades': {
      const d = await getPresidentGraphic();
      return d && buildPresident(d);
    }
  }
}

function buildGrade(d: GradeGraphic): Built {
  const c = d.counts;
  return {
    scene: gradeScene(d),
    retrieved: d.retrieved,
    caption: (
      <>
        <p>
          {fmtCount(d.total)} sitting members of Congress, one tile each, colored by Stock Trading Grade for trades dated {fmtDate(d.start)} to {fmtDate(d.end)}:
          {' '}{fmtCount(c.A)} A, {fmtCount(c.B)} B, {fmtCount(c.C)} C, {fmtCount(c.D)} D, {fmtCount(c.F)} F and {fmtCount(c.NG)} not graded.
        </p>
        <p className="text-[14.5px] text-muted">Same published method for every member. Not graded means filings we have not read fall inside the window, so no letter is shown.</p>
      </>
    ),
    method: 'Tiles run A to F, then not graded, alphabetically by last name within a grade. Hover a tile for the member.',
    table: (
      <table className="w-full min-w-[420px] text-[14.5px]">
        <caption className="sr-only">Members of Congress by Stock Trading Grade</caption>
        <thead><tr><th scope="col" className={th}>Grade</th><th scope="col" className={th}>Members</th><th scope="col" className={th}>Share of {fmtCount(d.total)}</th></tr></thead>
        <tbody className="divide-y divide-line">
          {GRADE_ORDER.map((l) => (
            <tr key={l}><th scope="row" className={`${td} text-left font-semibold`}>{l === 'NG' ? 'Not graded' : l}</th><td className={`${td} font-mono`}>{fmtCount(d.counts[l])}</td><td className={`${td} font-mono`}>{pct1(d.counts[l] / d.total)}</td></tr>
          ))}
        </tbody>
      </table>
    ),
    links: [
      { href: GRADE_METHOD_PATH, label: 'How the grade is worked out' },
      { href: MOST_ACTIVE_PATH, label: 'Most active traders' },
      { href: '/people', label: 'Every member, with their filings' },
    ],
  };
}

function buildFunding(d: FundingGraphic): Built {
  const top = d.segments.filter((s) => s.key !== 'other').slice(0, 3);
  return {
    scene: fundingScene(d),
    retrieved: d.retrieved,
    caption: (
      <>
        <p>
          The campaign committees of {fmtCount(d.members)} members of Congress reported {fmtUsd(d.total)} in total receipts in the 2025&ndash;26 FEC cycle, through reports on file as of {fmtDate(d.coverageLast)}.
        </p>
        <p className="text-[14.5px] text-muted">
          Largest groups: {top.map((s) => `${s.label} ${pct1(s.share)}`).join('; ')}. Taking legal PAC money is not misconduct; this graphic carries no grade. Last group is total receipts minus the six above; it is not an FEC category.
        </p>
      </>
    ),
    method: `Each share is of total receipts, so the groups plus loans, transfers and other receipts make 100%. ${d.excluded > 0 ? `${fmtCount(d.excluded)} of ${fmtCount(d.rows)} members with an FEC record are left out: the member pages print no shares for them either, because refunds or giver-side reports do not line up with the committee’s own receipts. ` : ''}Reports cover through dates from ${fmtDate(d.coverageFirst)} to ${fmtDate(d.coverageLast)}.`,
    table: (
      <table className="w-full min-w-[520px] text-[14.5px]">
        <caption className="sr-only">Receipts by source group, 2025-26 FEC cycle</caption>
        <thead><tr><th scope="col" className={th}>Source group</th><th scope="col" className={th}>Receipts</th><th scope="col" className={th}>Share of total receipts</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d.segments.map((s) => (
            <tr key={s.key}><th scope="row" className={`${td} text-left font-semibold`}>{s.label}</th><td className={`${td} font-mono`}>{fmtUsd(s.dollars)}</td><td className={`${td} font-mono`}>{pct1(s.share)}</td></tr>
          ))}
          <tr><th scope="row" className={`${td} text-left font-semibold`}>Total receipts</th><td className={`${td} font-mono`}>{fmtUsd(d.total)}</td><td className={`${td} font-mono`}>100%</td></tr>
        </tbody>
      </table>
    ),
    links: [
      { href: 'https://www.fec.gov/data/', label: 'Federal Election Commission data' },
      { href: '/people', label: 'Each member’s “Who funds them” panel' },
      { href: '/about/methodology', label: 'Methods' },
    ],
  };
}

function buildDelay(d: DelayGraphic): Built {
  return {
    scene: delayScene(d),
    retrieved: d.retrieved,
    caption: (
      <>
        <p>
          {fmtCount(d.over45)} of {fmtCount(d.total)} transactions ({pct1(d.share)}) were reported more than 45 days after the trade. The STOCK Act asks for a report within 30 days of the member learning of a trade and no later than 45 days after the trade.
        </p>
        <p className="text-[14.5px] text-muted">A gap over 45 days is a measured fact about two dates, not a finding about the filer.</p>
      </>
    ),
    method: `Days are counted from the trade date to the first report as filed. ${fmtCount(d.notComputed)} of ${fmtCount(d.allRows)} transactions have no computed gap and are not in the chart. Bar height is the number of transactions in each range; the ranges are not equal in width.`,
    table: (
      <table className="w-full min-w-[420px] text-[14.5px]">
        <caption className="sr-only">Transactions by days from trade to report</caption>
        <thead><tr><th scope="col" className={th}>Days from trade to report</th><th scope="col" className={th}>Transactions</th><th scope="col" className={th}>Share of {fmtCount(d.total)}</th></tr></thead>
        <tbody className="divide-y divide-line">
          {d.bins.map((b) => (
            <tr key={b.label}><th scope="row" className={`${td} text-left font-semibold`}>{b.label}</th><td className={`${td} font-mono`}>{fmtCount(b.count)}</td><td className={`${td} font-mono`}>{pct1(b.count / d.total)}</td></tr>
          ))}
          <tr><th scope="row" className={`${td} text-left font-semibold`}>More than 45 days</th><td className={`${td} font-mono`}>{fmtCount(d.over45)}</td><td className={`${td} font-mono`}>{pct1(d.share)}</td></tr>
        </tbody>
      </table>
    ),
    links: [
      { href: '/data/late-filers', label: 'Reports filed more than 45 days after the trade' },
      { href: '/data/trades', label: 'Trades explorer' },
      { href: '/about/methodology/trades', label: 'Methods for trades' },
    ],
  };
}

function buildPresident(d: PresidentGraphic): Built {
  const n = d.reports.length;
  const noted = d.reports.filter((r) => r.feeNote);
  return {
    scene: presidentScene(d),
    retrieved: d.retrieved,
    caption: (
      <>
        <p>
          President Trump reported {fmtCount(d.transactions)} securities transactions in {n} periodic transaction reports (OGE Form 278-T) signed between {fmtDate(d.firstSigned)} and {fmtDate(d.lastSigned)}, as posted by the U.S. Office of Government Ethics.
        </p>
        {d.notesLoaded && noted.length > 0 && (
          <p className="text-[14.5px]">
            On {noted.length} of the {n} reports, the reviewing official wrote in the comments box: &ldquo;Filer paid late fee(s).&rdquo; Every report also carries the agency ethics official&rsquo;s signed opinion that the filer is in compliance with applicable laws and regulations.
          </p>
        )}
      </>
    ),
    method: 'Reports signed within a week of each other share one column. Block height is the number of transactions in the report; amounts are not shown. Amounts on the form are bands, and the form does not show who decided a transaction.',
    table: (
      <table className="w-full min-w-[620px] text-[14.5px]">
        <caption className="sr-only">The reports, by date signed</caption>
        <thead><tr><th scope="col" className={th}>Report signed</th><th scope="col" className={th}>Transactions</th><th scope="col" className={th}>Reviewing official&rsquo;s comment, verbatim</th><th scope="col" className={th}>Report</th></tr></thead>
        <tbody className="divide-y divide-line">
          {[...d.reports].sort((a, b) => a.signed.localeCompare(b.signed) || b.transactions - a.transactions).map((r) => (
            <tr key={r.docId}>
              <th scope="row" className={`${td} whitespace-nowrap text-left font-semibold`}>{fmtDate(r.signed)}</th>
              <td className={`${td} font-mono`}>{fmtCount(r.transactions)}</td>
              <td className={td}>{r.feeNote ? <>&ldquo;{r.feeNote}&rdquo;{r.feeNoteDate ? `, dated ${fmtDate(r.feeNoteDate)}` : ''} <FilingLink href={`${r.url}#page=1`} source="OGE Form 278-T, page 1" label="Page 1" /></> : <span className="text-muted">None</span>}</td>
              <td className={td}><FilingLink href={r.url} source="OGE Form 278-T" label="View report" /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th scope="row" className={`${td} text-left font-semibold`}>All {n} reports</th><td className={`${td} font-mono`}>{fmtCount(d.transactions)}</td><td colSpan={2} className={`${td} text-muted`}>{d.classes.map((c) => `${c.label} ${fmtCount(c.count)}`).join(', ')}</td></tr>
        </tfoot>
      </table>
    ),
    links: [
      { href: PRESIDENT_PATH, label: 'Every transaction, with its report' },
    ],
  };
}
