import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import MemberRecordPanel from '@/components/v2/MemberRecordPanel';
import { Card, PageBand, SectionHead, Wrap } from '@/components/v2/PageBand';
import SourceBar from '@/components/v2/SourceBar';
import TradesTable from '@/components/v2/TradesTable';
import { getCampaignMoney, type CampaignMoneyResult } from '@/lib/v2/campaign-money';
import { getDatasetStatuses } from '@/lib/v2/datasets';
import { buildHref, one, type SP } from '@/lib/v2/explorer';
import { GRADE_METHOD_PATH, VOTER_PATH, campaignMoneyEnabled, gradesEnabled, voterPagesEnabled } from '@/lib/v2/flags';
import { fmtCount, fmtDate } from '@/lib/v2/format';
import { GRADE_FIXED_LINE } from '@/lib/v2/grade-method';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import type { Member } from '@/lib/v2/people';
import { pageMetadata } from '@/lib/v2/seo';
import { getStateRecords, getVoterStates, getWhatsNew, stateSlug, WHATS_NEW_DAYS, WHATS_NEW_SHOWN, type MemberRecord } from '@/lib/v2/voter';
import { VOTER_NOT_FINDING, VOTER_SCOPE, VOTER_TITLE, voterWhat } from '@/lib/v2/voter-copy';
import { lookupZip, ZCTA_SOURCE } from '@/lib/v2/zip';

export const revalidate = 1800;

// D11 per-state voter page (g1 §4, incumbents only). Behind voterPagesEnabled() (off on production unless SHOW_VOTER_PAGES=1).

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  if (!voterPagesEnabled()) return hiddenPageMetadata();
  const code = (await params).state.toUpperCase();
  const states = /^[A-Z]{2}$/.test(code) ? await getVoterStates() : null;
  const st = states?.find((s) => s.code === code);
  if (!st) return { title: VOTER_TITLE };
  return pageMetadata({
    path: `${VOTER_PATH}/${stateSlug(st.code)}`,
    title: `${st.name}: ${VOTER_TITLE.charAt(0).toLowerCase()}${VOTER_TITLE.slice(1)}`,
    description: `${st.name}'s current members of Congress, alphabetically by last name, each with the same panels: the stock trades they reported in the last 24 months and links to their filings.`,
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const districtLabel = (state: string, d: string) => (d === '98' ? `${state} delegate seat` : d === '0' ? `${state} at-large` : `${state}-${d}`);

export default async function VoterStatePage({ params, searchParams }: { params: Promise<{ state: string }>; searchParams: Promise<SP> }) {
  if (!voterPagesEnabled()) notFound();
  const raw = (await params).state;
  if (!/^[A-Za-z]{2}$/.test(raw)) notFound();
  if (raw !== raw.toLowerCase()) permanentRedirect(`${VOTER_PATH}/${raw.toLowerCase()}`);
  const code = raw.toUpperCase();
  const sp = await searchParams;
  const zipRaw = one(sp.zip).trim();
  const zip = /^\d{5}$/.test(zipRaw) ? zipRaw : '';

  const gradesOn = gradesEnabled();
  const moneyOn = campaignMoneyEnabled();
  const [data, statuses] = await Promise.all([getStateRecords(code), getDatasetStatuses(['house_trades', 'senate_trades', 'members'])]);
  if (data === undefined) notFound();

  const head = (name: string) => (
    <PageBand>
      <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.06em] text-on-deep max-md:mt-5">
        <Link href={VOTER_PATH} className="hover:underline">{VOTER_TITLE}</Link>
      </p>
      <h1 className="mt-1 font-display text-[44px] font-extrabold leading-[1.06] tracking-[-1px] max-md:text-[30px]">{name}</h1>
      <div className="mt-3 max-w-[860px] space-y-1.5 text-[16px] text-on-deep max-md:text-[15px]">
        <p>{voterWhat(moneyOn)}</p>
        <p className="font-semibold text-white">{VOTER_SCOPE}</p>
        <p>{VOTER_NOT_FINDING}</p>
      </div>
    </PageBand>
  );

  if (data === null) {
    return (
      <div data-v2>
        {head(code)}
        <Wrap className="pb-12 pt-6">
          <EmptyState title="This page's data is unavailable right now" tone="warning" statuses={statuses}>
            The members database did not answer, so nothing is shown. Try again in a few minutes.
          </EmptyState>
        </Wrap>
      </div>
    );
  }

  const { state, senators, house, win } = data;
  const all = [...senators, ...house];
  const [news, moneyList] = await Promise.all([
    getWhatsNew(all.map((r) => r.member.bioguide_id)),
    moneyOn ? Promise.all(all.map((r) => getCampaignMoney(r.member.bioguide_id))) : Promise.resolve(null),
  ]);
  const money = new Map<string, CampaignMoneyResult>(moneyList ? all.map((r, i) => [r.member.bioguide_id, moneyList[i]]) : []);

  const st = Object.fromEntries(statuses.map((s) => [s.key, s]));
  const asOf = [
    st.house_trades?.lastUpdated ? `House trades as of ${fmtDate(st.house_trades.lastUpdated)}` : null,
    st.senate_trades?.lastUpdated ? `Senate trades as of ${fmtDate(st.senate_trades.lastUpdated)}` : null,
    st.members?.lastUpdated ? `members as of ${fmtDate(st.members.lastUpdated)}` : null,
    win ? `trading figures for trades dated ${fmtDate(win.start)} to ${fmtDate(win.end)}` : null,
  ].filter(Boolean).join(' · ');

  const panel = (r: MemberRecord) => (
    <li key={r.member.bioguide_id}>
      <MemberRecordPanel rec={r} gradesOn={gradesOn} moneyOn={moneyOn} money={money.get(r.member.bioguide_id) ?? null} />
    </li>
  );

  return (
    <div data-v2>
      {head(state.name)}
      <Wrap className="pb-12">
        <SourceBar datasets={['house_trades', 'senate_trades', 'members']} className="mt-6" />
        <div className="mt-4 space-y-1 text-[13.5px] text-muted">
          {asOf && <p data-asof>{asOf[0].toUpperCase() + asOf.slice(1)}.</p>}
          {gradesOn && <p className="font-semibold text-ink">{GRADE_FIXED_LINE} <Link href={GRADE_METHOD_PATH} className="font-normal underline">Method</Link></p>}
        </div>

        {(zip || zipRaw) && <ZipNote zip={zip} raw={zipRaw} state={state.code} house={house.map((r) => r.member)} hasSenators={senators.length > 0} />}

        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 text-[14px]">
          <a href="#senate" className="rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint">Senate ({fmtCount(senators.length)})</a>
          <a href="#house" className="rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint">House ({fmtCount(house.length)})</a>
          <a href="#whats-new" className="rounded-full bg-card px-3.5 py-1.5 font-semibold shadow-[0_0_0_1px_var(--color-line)] hover:bg-neutral-tint">What&rsquo;s new</a>
          <Link href={VOTER_PATH} className="rounded-full px-3.5 py-1.5 font-semibold text-trades-ink hover:underline">Another state</Link>
        </nav>

        <section id="senate" className="scroll-mt-24 pt-8" aria-labelledby="h-senate">
          <h2 id="h-senate" className="mb-4 font-display text-[28px] font-extrabold max-md:text-[24px]">U.S. Senate</h2>
          {senators.length ? (
            <ul className="space-y-4">{senators.map(panel)}</ul>
          ) : (
            <p className="rounded-2xl bg-card px-4 py-3 text-[14.5px] text-muted shadow-card">{state.name} has no seats in the U.S. Senate.</p>
          )}
        </section>

        <section id="house" className="scroll-mt-24 pt-10" aria-labelledby="h-house">
          <h2 id="h-house" className="mb-4 font-display text-[28px] font-extrabold max-md:text-[24px]">U.S. House</h2>
          {house.length ? (
            <ul className="space-y-4">{house.map(panel)}</ul>
          ) : (
            <p className="rounded-2xl bg-card px-4 py-3 text-[14.5px] text-muted shadow-card">No current House member in our roster for {state.name}.</p>
          )}
        </section>

        <section id="whats-new" className="scroll-mt-24 pt-10" aria-labelledby="h-new">
          <Card>
            <SectionHead
              as="h2"
              title={<span id="h-new" className="text-[24px] max-md:text-[22px]">What&rsquo;s new: trades reported in the last {WHATS_NEW_DAYS} days</span>}
              sub={news ? `Disclosed transactions by ${state.name}'s current members whose first report is dated ${fmtDate(news.since)} to ${fmtDate(news.until)}, newest report first. Each row links to the official filing.` : undefined}
            />
            {!news ? (
              <p className="rounded-2xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink">Unavailable right now: the trade database did not answer.</p>
            ) : news.rows.length === 0 ? (
              <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted" data-whats-new="0">
                No new trade reports from {state.name}&rsquo;s current members in the filings we have read for {fmtDate(news.since)} to {fmtDate(news.until)}.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[14px]" data-whats-new={news.rows.length}>
                  {fmtCount(news.rows.length)} disclosed {news.rows.length === 1 ? 'transaction' : 'transactions'} by {fmtCount(new Set(news.rows.map((t) => t.bio_guide_id)).size)} {new Set(news.rows.map((t) => t.bio_guide_id)).size === 1 ? 'member' : 'members'}.
                  {news.rows.length > WHATS_NEW_SHOWN ? ` The newest ${WHATS_NEW_SHOWN} are listed.` : ''}
                </p>
                <TradesTable trades={news.rows.slice(0, WHATS_NEW_SHOWN)} caption={`Trades by ${state.name}'s members reported in the last ${WHATS_NEW_DAYS} days`} captionHidden ordered />
                <p className="mt-3 text-[13.5px]">
                  <Link href={buildHref('/data/trades', { state: state.code, by: 'filed', from: news.since })} className="font-semibold text-trades-ink hover:underline">
                    {state.name} trades by report date in the trades explorer
                  </Link>
                </p>
              </>
            )}
            <p className="mt-3 text-[12.5px] text-muted">
              Reports are posted by the House Clerk and the Senate up to 45 days after a trade, and some later, so this list fills in over time.
              Scanned and paper reports we have not read are not included.
            </p>
          </Card>
        </section>
      </Wrap>
    </div>
  );
}

function ZipNote({ zip, raw, state, house, hasSenators }: { zip: string; raw: string; state: string; house: Member[]; hasSenators: boolean }) {
  const cands = zip ? lookupZip(zip) : null;
  const here = (cands ?? []).filter((c) => c.state === state);
  const elsewhere = [...new Set((cands ?? []).filter((c) => c.state !== state).map((c) => c.state))];
  return (
    <section className="pt-6" aria-labelledby="zip-note">
      <Card>
        <h2 id="zip-note" className="font-display text-[20px] font-extrabold">{zip ? <>ZIP code <span className="font-mono">{zip}</span></> : 'Enter a 5-digit ZIP code'}</h2>
        {!zip ? (
          <p className="mt-1.5 text-[14.5px] text-muted">&ldquo;{raw.slice(0, 12)}&rdquo; is not a 5-digit ZIP code.</p>
        ) : !cands || cands.length === 0 ? (
          <p className="mt-1.5 text-[14.5px] text-muted">We can&rsquo;t place this ZIP: it is not in the Census ZIP Code Tabulation Areas (PO-box-only and business ZIPs have none).</p>
        ) : (
          <>
            {here.length > 0 && (
              <>
                <p className="mt-1.5 text-[14.5px]">
                  {here.length > 1 ? `This ZIP area crosses ${here.length} districts in this state, so you may live in any of them (shares are of the ZIP's land area, not its people):` : 'This ZIP area lies in one district:'}
                </p>
                <ul className="mt-2 space-y-1 text-[14.5px]">
                  {here.map((c) => {
                    const reps = house.filter((m) => c.district === '98' || String(Number(m.district ?? -1)) === c.district);
                    return (
                      <li key={c.district}>
                        <b>{districtLabel(c.state, c.district)}</b>{here.length > 1 ? ` (${c.landPct < 1 ? 'under 1' : c.landPct}% of the ZIP's land)` : ''}:{' '}
                        {reps.length ? reps.map((m, i) => <span key={m.bioguide_id}>{i ? ', ' : ''}<a href={`#m-${m.bioguide_id}`} className="font-semibold text-trades-ink hover:underline">{m.name}</a></span>) : <span className="text-muted">no current member in our roster for this seat</span>}
                      </li>
                    );
                  })}
                </ul>
                {hasSenators && <p className="mt-1.5 text-[14px] text-muted">Both senators below represent the whole state.</p>}
              </>
            )}
            {elsewhere.length > 0 && (
              <p className="mt-1.5 text-[14.5px]">
                {here.length ? 'Part of this ZIP area is in ' : 'This ZIP area is in '}
                {elsewhere.map((s, i) => <span key={s}>{i ? ', ' : ''}<Link href={`${VOTER_PATH}/${stateSlug(s)}?zip=${zip}`} className="font-semibold text-trades-ink hover:underline">{s}</Link></span>)}.
              </p>
            )}
            <p className="mt-2 text-[12.5px] text-muted">
              Source: <a href={ZCTA_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">{ZCTA_SOURCE.name}</a> (2020 ZCTAs, districts of the 119th Congress). ZCTAs approximate ZIP codes; the House&rsquo;s &ldquo;Find your representative&rdquo; tool can tell from your street address.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
