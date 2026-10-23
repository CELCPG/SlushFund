import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import {
  BinsTable,
  FeeBlock,
  FundsDetails,
  MembersTable,
  MonthBars,
  OilList,
  PostingBars,
  RulesBox,
  SicTable,
  StoryWide,
  WindowsTable,
  iranLink as link,
} from '@/components/v2/iran-war/IranWarParts';
import WarTimeline, { type TlDay, type TlMarker } from '@/components/v2/iran-war/WarTimeline';
import { RailNote, SERIF, StoryFooter, StoryHeader, StorySection } from '@/components/v2/story/Story';
import { GRADE_METHOD_PATH, iranWarDraftRefused, iranWarStoryEnabled, IRAN_WAR_PATH } from '@/lib/v2/flags';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { getIranWar, getIranWarInputs } from '@/lib/v2/iran-war';
import { WAR_START, addDays, fmtInt, windowDef, type IranWarFigures } from '@/lib/v2/iran-war-core';
import * as C from '@/lib/v2/iran-war-copy';
import { chronologyFile } from '@/lib/v2/iran-war-files';
import { pageMetadata } from '@/lib/v2/seo';

export const revalidate = 3600;

// W2: the Iran war investigation. Behind SHOW_IRAN_WAR_STORY (off on production), and refused on production while the copy is
// DRAFT_UNTIL_AW1. Every figure is computed from live rows by iran-war-core.ts; every sentence lives in iran-war-copy.ts.

export async function generateMetadata(): Promise<Metadata> {
  if (!iranWarStoryEnabled() || iranWarDraftRefused(C.DRAFT_UNTIL_AW1)) return hiddenPageMetadata();
  return pageMetadata({
    path: IRAN_WAR_PATH,
    title: C.IRAN_WAR_HEADLINE,
    description: C.IRAN_WAR_DESCRIPTION,
    card: 'own',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const COLS3 = [
  { key: 'P1', head: 'Jan 2 to Feb 27' },
  { key: 'P2', head: 'Feb 28 to Mar 31' },
  { key: 'P3', head: 'Apr 1 to Jul 31' },
] as const;
const COLS4 = [{ key: 'P0', head: '2025 (context)' }, ...COLS3] as const;

function timelineData(f: IranWarFigures): { days: TlDay[]; markers: TlMarker[]; brent: { d: string; v: number }[] } {
  return {
    days: f.days.map((d) => ({
      d: d.date, g: d.chron.government, p: d.chron.president_post, o: d.chron.oversight, l: d.chron.labelled,
      bp: [d.purchases.ED, d.purchases.other, d.purchases.unclassified], sl: [d.sales.ED, d.sales.other, d.sales.unclassified],
      x: d.exchanges, t: d.total, b: d.brent,
    })),
    markers: f.markers.map((m) => ({ id: m.id, d: m.date, t: m.time, k: m.lane === 'government' ? 'g' : m.lane === 'president_post' ? 'p' : 'o', l: m.labelled, label: m.label })),
    brent: f.brent.map((b) => ({ d: b.date, v: b.value })),
  };
}

export default async function IranWarPage() {
  if (!iranWarStoryEnabled()) notFound();
  // The draft guard: with DRAFT_UNTIL_AW1 true the story never renders on the production deployment, flag or no flag.
  if (iranWarDraftRefused(C.DRAFT_UNTIL_AW1)) notFound();

  const [f, inp] = await Promise.all([getIranWar(), getIranWarInputs()]);
  const header = { kicker: C.IRAN_WAR_KICKER, byline: `By ${C.IRAN_WAR_BYLINE} · ${C.IRAN_WAR_STORY_DATE}` };
  const meta = { published: C.IRAN_WAR_STORY_DATE, updated: 'Not updated', verified: C.DRAFT_UNTIL_AW1 ? 'Not yet audited' : 'See audit', audit: C.DRAFT_UNTIL_AW1 ? C.DRAFT_BANNER : 'Audited' };
  const banner = C.DRAFT_UNTIL_AW1 && (
    <div role="note" className="bg-stale-tint text-stale-ink" data-draft-banner>
      <div className="mx-auto max-w-[1240px] px-8 py-3 text-[14px] max-md:px-4">
        <b className="font-extrabold">{C.DRAFT_BANNER}.</b> {C.DRAFT_BANNER_NOTE}
      </div>
    </div>
  );

  if (!f || !inp) {
    return (
      <div data-v2 data-story="president-iran-war">
        {banner}
        <StoryHeader kicker={header.kicker} headline={C.IRAN_WAR_HEADLINE} dek="The figures for this story could not be read from our database right now." meta={meta} byline={header.byline} />
        <section className="border-t border-line py-9">
          <div className="mx-auto max-w-[1240px] px-8 max-md:px-4">
            <EmptyState title="Figures unavailable right now" action={{ href: '/investigations', label: 'All investigations' }}>
              We print no figure we cannot read from the records. Please try again in a few minutes.
            </EmptyState>
          </div>
        </section>
      </div>
    );
  }

  const p = f.president;
  const chron = chronologyFile();
  const tl = timelineData(f);
  const oversight = inp.chron.filter((c) => c.lane === 'oversight').sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id));
  const w = (k: 'P1' | 'P2' | 'P3') => windowDef(k);
  const monthCounts = p.monthly.map((m) => ({ month: m.month, n: m.table.all.n }));
  const m3 = p.m3;
  const cg = f.congress;

  return (
    <div data-v2 data-story="president-iran-war" data-draft={C.DRAFT_UNTIL_AW1 ? 'true' : 'false'}>
      {banner}
      <StoryHeader kicker={header.kicker} headline={C.IRAN_WAR_HEADLINE} dek={<span data-sentence="dek">{C.dek(f)}</span>} meta={meta} byline={header.byline}>
        <div className="mt-4 max-w-[760px] space-y-2 rounded-xl border border-line bg-card p-4 font-sans text-[14.5px] leading-relaxed" data-selection>
          <p data-selection-line>{C.IRAN_WAR_SELECTION_LINE}</p>
        </div>
      </StoryHeader>

      <div id="the-account" className="scroll-mt-6">
        <StorySection
          kicker="What the records are"
          title="The account"
          rail={
            <RailNote title="Where this page begins">
              <ul className="list-disc space-y-1 pl-4">
                <li><a href="#before" className={link}>Before the strikes</a></li>
                <li><a href="#first-month" className={link}>The war&rsquo;s first month</a></li>
                <li><a href="#timeline" className={link}>The timeline</a></li>
                <li><a href="#test" className={link}>The test</a></li>
                <li><a href="#oil" className={link}>The oil-futures questions</a></li>
                <li><a href="#public" className={link}>When the public saw it</a></li>
                <li><a href="#congress" className={link}>The same yardstick</a></li>
                <li><a href="#limits" className={link}>What these records don&rsquo;t show</a></li>
                <li><a href="#method" className={link}>Method and downloads</a></li>
              </ul>
            </RailNote>
          }
        >
          {C.accountLines(f).map((t, i) => <p key={i} data-sentence={`account-${i}`}>{t}</p>)}
          <RulesBox title={C.QUALIFIED_TRUST_TITLE} lead={C.QUALIFIED_TRUST_LEAD} quotes={C.QUALIFIED_TRUST_QUOTES} found={C.QUALIFIED_TRUST_FOUND} />
        </StorySection>
      </div>

      <div id="before" className="scroll-mt-6">
        <StorySection kicker={C.WINDOW_KICKER.P1} title="Before the strikes">
          {C.beforeLines(f).map((t, i) => <p key={i} data-sentence={`before-${i}`}>{t}</p>)}
          <p data-sentence="volume">{C.volumeLine(f)}</p>
          <MonthBars months={monthCounts} />
          <SicTable id="sic-p1" title={C.SIC_CAPTION(w('P1').label)} rows={p.sicMix.P1} note={<p>Industry is the issuer&rsquo;s SEC industry code. &ldquo;None&rdquo; is an issuer we could not match to an SEC registrant, and we do not guess.</p>} />
          <FundsDetails summary={C.FUNDS_SUMMARY('Jan 2 to Feb 27, 2026')} rows={p.funds.P1} />
        </StorySection>
      </div>

      <div id="first-month" className="scroll-mt-6">
        <StorySection kicker={C.WINDOW_KICKER.P2} title="The war's first month">
          <p data-sentence="strikes">{C.STRIKES_LINE}</p>
          {C.firstMonthLines(f).map((t, i) => <p key={i} data-sentence={`first-${i}`}>{t}</p>)}
          <WindowsTable id="windows" title={C.WINDOWS_CAPTION} cols={COLS4} tables={p.windows} disclosure={p.disclosure} />
          <SicTable id="sic-p2" title={C.SIC_CAPTION(w('P2').label)} rows={p.sicMix.P2} />
          <FundsDetails summary={C.FUNDS_SUMMARY('Feb 28 to Mar 31, 2026')} rows={p.funds.P2} />
        </StorySection>
      </div>

      <div id="timeline" className="scroll-mt-6">
        <StoryWide kicker="Day by day" title="The timeline" intro={C.chronologyLines(f).map((t, i) => <p key={i} data-sentence={`chron-${i}`}>{t}</p>)}>
          <WarTimeline
            days={tl.days}
            markers={tl.markers}
            brent={tl.brent}
            dayUrlBase={`${IRAN_WAR_PATH}/days`}
            edges={{ warStart: WAR_START, month2: addDays(windowDef('P2').to, 1) }}
            text={{
              fixedLine: C.IRAN_WAR_FIXED_LINE,
              intro: C.TIMELINE_INTRO,
              legendWide: C.TIMELINE_LEGEND_WIDE,
              legendNarrow: C.TIMELINE_LEGEND_NARROW,
              keyboard: C.TIMELINE_KEYBOARD,
              toTable: C.TABLE_TOGGLE_ON,
              toChart: C.TABLE_TOGGLE_OFF,
              brentLine: C.BRENT_LINE,
              noChron: C.DAY_NO_CHRON,
              noTx: C.DAY_NO_TX,
              noneED: C.DAY_NONE_ED,
              labelledShow: C.labelledShow(f.chronology.labelled),
              labelledHide: C.LABELLED_HIDE,
              loading: C.DAY_LOADING,
              error: C.DAY_ERROR,
              brentOn: C.DAY_BRENT,
              brentNone: C.DAY_BRENT_NONE,
              dayCount: C.DAY_COUNT,
            }}
          />
        </StoryWide>
      </div>

      <div id="test" className="scroll-mt-6">
        <StorySection kicker="Pre-registered" title="The test">
          <p data-sentence="test-question">{C.TEST_QUESTION}</p>
          <p data-sentence="m3" className="font-semibold">{C.m3Result(m3, '')}</p>
          <p data-sentence="m3-sales">{C.m3Sales(p.m3Sales, '')}</p>
          <p data-sentence="test-scope">{C.TEST_SCOPE}</p>
          <p data-sentence="test-only">{C.TEST_ONLY}</p>
        </StorySection>
      </div>

      <div id="oil" className="scroll-mt-6">
        <StorySection kicker={C.OIL_KICKER} title="The oil-futures questions">
          {C.oilLines(f).map((t, i) => <p key={i} data-sentence={`oil-${i}`}>{t}</p>)}
          <OilList rows={oversight.map((c) => ({ id: c.id, date: c.event_date, text: c.event_text, sourceUrl: c.source_url, archiveUrl: c.archive_url }))} />
        </StorySection>
      </div>

      <div id="public" className="scroll-mt-6">
        <StorySection kicker="Disclosure" title="When the public saw it">
          <p data-sentence="public-intro">{C.PUBLIC_INTRO}</p>
          <PostingBars posting={p.posting} />
          {(['P1', 'P2', 'P3'] as const).map((k) => <p key={k} data-sentence={`over45-${k}`}>{C.over45Line(p.disclosure[k], k)}</p>)}
          <BinsTable id="bins-sign" markOver45 title={C.BINS_CAPTION} cols={COLS3} bins={{ P1: p.disclosure.P1.signBins, P2: p.disclosure.P2.signBins, P3: p.disclosure.P3.signBins }} />
          <BinsTable id="bins-post" title={C.POST_BINS_CAPTION} cols={COLS3} bins={{ P1: p.disclosure.P1.postBins, P2: p.disclosure.P2.postBins, P3: p.disclosure.P3.postBins }} />
          {p.fees.length > 0 && (
            <>
              <p data-sentence="fee-intro">{C.feeIntro(p.fees, p.reportsInWindows)}</p>
              <div className="space-y-3" data-fee-covers>
                {p.fees.map((c) => <FeeBlock key={c.docId} cover={c} />)}
              </div>
            </>
          )}
        </StorySection>
      </div>

      <div id="congress" className="scroll-mt-6">
        <StorySection kicker={C.CONGRESS_KICKER} title="The same yardstick: members of Congress">
          {C.congressLines(f).map((t, i) => <p key={i} data-sentence={`congress-${i}`}>{t}</p>)}
          <WindowsTable
            id="congress-windows"
            title="Members of Congress together, by window"
            cols={COLS3}
            tables={cg.pooled.windows}
            disclosure={cg.pooled.disclosure}
            showOptions
            lateLabel={C.CONGRESS_LATENESS_LABEL}
            note={<p data-sentence="congress-lateness">{C.CONGRESS_LATENESS_NOTE}</p>}
          />
          {[cg.pooled, cg.house, cg.senate].map((g, gi) => (
            <div key={g.label} className="space-y-2" data-congress-test={g.label}>
              <h3 className="font-sans text-[16px] font-extrabold">{g.label === 'All members' ? 'All members' : `${g.label} (${fmtInt(g.members)} members)`}</h3>
              {C.congressTestLines(g).map((t, i) => <p key={i} data-sentence={`congress-test-${gi}-${i}`}>{t}</p>)}
            </div>
          ))}
          <MembersTable rows={cg.members} caption={C.CONGRESS_TABLE_CAPTION} />
          <p data-sentence="congress-note" className="font-sans text-[14px] text-muted">{C.CONGRESS_NOTE}</p>
        </StorySection>
      </div>

      <div id="limits" className="scroll-mt-6">
        <StorySection kicker="Limits" title="What these records don't show">
          <ul className="list-disc space-y-2 pl-6">{C.LIMITS.map((t) => <li key={t}>{t}</li>)}</ul>
        </StorySection>
      </div>

      <div id="method" className="scroll-mt-6">
        <StorySection kicker="Method" title="How this page was built, and the data">
          <p data-sentence="prereg">{C.PREREG_LINE}</p>
          {C.CHRONOLOGY_LINES.map((t, i) => <p key={i} data-sentence={`method-chron-${i}`}>{t}</p>)}
          <ul className="list-disc space-y-2 pl-6">{C.GROUPS_LINES.map((t) => <li key={t}>{t}</li>)}</ul>
          <ul className="list-disc space-y-2 pl-6">{C.MEASURES_LINES.map((t) => <li key={t}>{t}</li>)}</ul>
          <div className="rounded-2xl border border-line bg-card p-5 font-sans text-[15px] leading-relaxed max-md:p-4" data-downloads>
            <h3 className="text-[18px] font-extrabold">Downloads</h3>
            <ul className="mt-3 space-y-2">
              <li><a href={`${IRAN_WAR_PATH}/preregistration.md`} className={link}>{C.DOWNLOADS.prereg}</a></li>
              <li>
                <a href={`${IRAN_WAR_PATH}/chronology.csv`} download className={link}>{C.DOWNLOADS.chronology}</a>
                <br />
                <span className="font-mono text-[13px] break-all" data-chronology-sha>{chron.ok ? C.chronologyShaLine(chron.sha256) : 'Figures unavailable'}</span>
              </li>
              <li><a href={`${IRAN_WAR_PATH}/issuer-map.csv`} download className={link}>{C.DOWNLOADS.issuers}</a></li>
            </ul>
          </div>
        </StorySection>
      </div>

      <StorySection kicker="Responses" title="Right of reply">
        <p data-sentence="responses-intro">{C.RESPONSES_INTRO}</p>
        <ul className="space-y-3" data-responses>
          {C.IRAN_WAR_ASKED.map((who) => <li key={who} data-response={who}><p>{C.iranWarAskedLine(who)}</p></li>)}
        </ul>
      </StorySection>

      {/* The "Our view" box: AW1's allowed sentence R6 verbatim, approved by Colin on 2026-10-23 at 16:02 EDT: opinion about policy, visually
          separate from the reporting, no data-sentence figure slots. The short AW1 re-audit checks it before DRAFT_UNTIL_AW1 can fall. */}
      <div id="our-view" className="scroll-mt-6">
        <section className="border-t border-line py-9">
          <div className="mx-auto max-w-[1240px] px-8 max-md:px-4">
            <div className="max-w-[760px] rounded-2xl border-2 border-line bg-card p-6 max-md:p-4" data-our-view>
              <p className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-trades-ink">{C.IRAN_WAR_OUR_VIEW_LABEL}</p>
              <p style={{ fontFamily: SERIF }} className="mt-3 text-[19px] leading-[1.7] max-md:text-[17.5px] max-md:leading-[1.65]" data-sentence="our-view">{C.IRAN_WAR_OUR_VIEW_SENTENCES.join(' ')}</p>
              <p style={{ fontFamily: SERIF }} className="mt-4 text-[19px] leading-[1.7] max-md:text-[17.5px] max-md:leading-[1.65]">
                <a href={GRADE_METHOD_PATH} className={link} data-sentence="our-view-card">{C.IRAN_WAR_OUR_VIEW_CARD_LEAD}</a>{C.IRAN_WAR_OUR_VIEW_CARD_TAIL}
              </p>
            </div>
          </div>
        </section>
      </div>

      <StoryFooter corrections={<p>None.</p>} />
    </div>
  );
}
