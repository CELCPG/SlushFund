import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { one, type SP } from '@/lib/v2/explorer';
import { VOTER_PATH, campaignMoneyEnabled, voterPagesEnabled } from '@/lib/v2/flags';
import { fmtCount } from '@/lib/v2/format';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';
import { getVoterStates, stateSlug } from '@/lib/v2/voter';
import { VOTER_NOT_FINDING, VOTER_SCOPE, VOTER_TITLE, voterWhat } from '@/lib/v2/voter-copy';
import { lookupZip, ZCTA_SOURCE } from '@/lib/v2/zip';

export const revalidate = 1800;

// D11 voter pages: the index (state picker + ZIP lookup). Behind voterPagesEnabled() (off on production unless SHOW_VOTER_PAGES=1).

export function generateMetadata(): Metadata {
  if (!voterPagesEnabled()) return hiddenPageMetadata();
  return pageMetadata({
    path: VOTER_PATH,
    title: VOTER_TITLE,
    description: 'Pick your state or enter your ZIP code to see your current members of Congress, each with the same panels: the stock trades they reported and links to their filings.',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

export default async function VoterIndexPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!voterPagesEnabled()) notFound();
  const sp = await searchParams;
  const states = await getVoterStates();
  const codes = new Set((states ?? []).map((s) => s.code));

  // The state picker (a GET form, no JS) lands here with ?state=xx.
  const picked = one(sp.state).trim().toUpperCase();
  if (picked && codes.has(picked)) redirect(`${VOTER_PATH}/${stateSlug(picked)}`);

  // ZIP lookup (the D2 lookup): a ZIP area in one state goes straight to that state's page.
  const zipRaw = one(sp.zip).trim();
  const zip = /^\d{5}$/.test(zipRaw) ? zipRaw : '';
  const cands = zip ? lookupZip(zip) : null;
  const zipStates = [...new Set((cands ?? []).map((c) => c.state))].filter((s) => codes.has(s));
  if (zip && zipStates.length === 1) redirect(`${VOTER_PATH}/${stateSlug(zipStates[0])}?zip=${zip}#zip-note`);

  const field = 'h-12 min-w-0 rounded-xl border border-white/20 bg-white px-4 text-[16px] text-ink focus:outline-none';
  const statuses = states ? null : await getDatasetStatuses(['members']);

  return (
    <div data-v2>
      <PageBand>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">Congress</p>
        <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{VOTER_TITLE}</h1>
        <div className="mt-3 max-w-[860px] space-y-1.5 text-[16px] text-on-deep max-md:text-[15px]">
          <p>{voterWhat(campaignMoneyEnabled())}</p>
          <p className="font-semibold text-white">{VOTER_SCOPE}</p>
          <p>{VOTER_NOT_FINDING}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <form action={VOTER_PATH} method="get" role="search" aria-label="Find your members by ZIP code" className="flex gap-2 max-sm:w-full">
            <label htmlFor="vz" className="sr-only">Your ZIP code</label>
            <input id="vz" name="zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} defaultValue={zip || zipRaw.slice(0, 5)} placeholder="Your ZIP code" autoComplete="postal-code" className={`${field} w-[180px] font-mono placeholder:font-sans placeholder:text-muted max-sm:w-auto max-sm:flex-1`} />
            <button type="submit" className="h-12 shrink-0 rounded-xl bg-brand px-5 text-[15px] font-bold text-white hover:brightness-110 max-sm:px-4">Find my members</button>
          </form>
          {states && (
            <form action={VOTER_PATH} method="get" aria-label="Pick your state" className="flex gap-2 max-sm:w-full">
              <label htmlFor="vs" className="sr-only">Your state</label>
              <select id="vs" name="state" defaultValue="" className={`${field} w-[220px] max-sm:w-auto max-sm:flex-1`}>
                <option value="" disabled>Pick your state</option>
                {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              <button type="submit" className="h-12 shrink-0 rounded-xl bg-white/15 px-5 text-[15px] font-bold text-white hover:bg-white/25 max-sm:px-4">Go</button>
            </form>
          )}
        </div>
      </PageBand>

      <Wrap className="pb-12">
        <SourceBar datasets={['members', 'house_trades', 'senate_trades']} className="mt-6" />

        {(zip || zipRaw) && (
          <section className="pt-6" aria-labelledby="zip-result">
            <Card>
              <h2 id="zip-result" className="font-display text-[22px] font-extrabold">{zip ? <>ZIP code <span className="font-mono">{zip}</span></> : 'Enter a 5-digit ZIP code'}</h2>
              <p className="mt-1.5 text-[14.5px] text-muted">
                {!zip
                  ? <>&ldquo;{zipRaw.slice(0, 12)}&rdquo; is not a 5-digit ZIP code.</>
                  : !cands || cands.length === 0
                    ? 'We can’t place this ZIP: it is not in the Census ZIP Code Tabulation Areas (PO-box-only and business ZIPs have none). Pick your state below instead.'
                    : <>This ZIP area crosses more than one state: {zipStates.map((s, i) => <span key={s}>{i ? ', ' : ''}<Link href={`${VOTER_PATH}/${stateSlug(s)}?zip=${zip}#zip-note`} className="font-semibold text-trades-ink hover:underline">{s}</Link></span>)}.</>}
              </p>
              <p className="mt-2 text-[12.5px] text-muted">Source: <a href={ZCTA_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">{ZCTA_SOURCE.name}</a>. ZCTAs approximate ZIP codes.</p>
            </Card>
          </section>
        )}

        <section className="pt-8" aria-labelledby="states">
          <Card>
            <SectionHead as="h2" title={<span id="states" className="text-[24px] max-md:text-[22px]">States, DC and territories</span>} sub="Each page lists the current senators and House members, alphabetically by last name." />
            {!states ? (
              <EmptyState title="The member list is unavailable right now" tone="warning" statuses={statuses ?? undefined}>
                The members database did not answer, so nothing is shown. Try again in a few minutes.
              </EmptyState>
            ) : (
              <ul className="grid grid-cols-4 gap-2 max-lg:grid-cols-3 max-md:grid-cols-2">
                {states.map((s) => (
                  <li key={s.code}>
                    <Link href={`${VOTER_PATH}/${stateSlug(s.code)}`} className="block rounded-2xl bg-page px-4 py-2.5 hover:bg-trades-tint">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="block text-[12.5px] text-muted">
                        {s.senators ? `${fmtCount(s.senators)} ${s.senators === 1 ? 'senator' : 'senators'} · ` : ''}{fmtCount(s.house)} House {s.house === 1 ? 'member' : 'members'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </Wrap>
    </div>
  );
}
