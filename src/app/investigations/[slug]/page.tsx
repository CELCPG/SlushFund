import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EmptyState from '@/components/v2/EmptyState';
import StoryResponse from '@/components/v2/story/Response';
import { Cite, RailNote, StoryFooter, StoryHeader, StorySection } from '@/components/v2/story/Story';
import { AwardsTable, FyTable, RecipientTable, StoryFigure } from '@/components/v2/story/StoryTables';
import { investigationsV2Enabled } from '@/lib/v2/flags';
import { hiddenPageMetadata } from '@/lib/v2/hidden-page';
import { pageMetadata } from '@/lib/v2/seo';
import { getStoryData } from '@/lib/v2/story-data';
import {
  CAVEAT_OBLIGATIONS,
  CONTEXT_LINE,
  ENTITY_CSV_PATH,
  ENTITY_RULE_LINE,
  FIGURES_AUDITED,
  INVESTIGATIONS_PATH,
  NOT_CAUSE_LINE,
  NUMBERS_ORDER,
  STORIES,
  STORY_BYLINE,
  STORY_KICKER,
  STORY_PUBLISHED,
  agencyTable,
  categoryTable,
  caveats,
  dateLine,
  howBuilt,
  largestAwards,
  preregLine,
  recipientTable,
  savedQuery,
  storyBySlug,
  storyNotes,
  storyPath,
  typeTableNote,
  whyLines,
} from '@/lib/v2/story-figures';

export const revalidate = 3600;
export const dynamicParams = false;

// D12: the four investigation posts (two matched pairs, G8). Behind investigationsV2Enabled() (off on production unless
// SHOW_INVESTIGATIONS_V2=1). Every sentence is built from live rows with the Auditor's allowed wording (story-figures.ts).

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!investigationsV2Enabled()) return hiddenPageMetadata();
  const story = storyBySlug((await params).slug);
  if (!story) return hiddenPageMetadata();
  return pageMetadata({
    path: storyPath(story.slug),
    title: story.headline,
    description: story.description,
    card: 'own',
    robots: process.env.VERCEL_ENV !== 'production' ? { index: false, follow: false } : undefined,
  });
}

const link = 'font-semibold text-trades-ink underline-offset-2 hover:underline';

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!investigationsV2Enabled()) notFound();
  const story = storyBySlug((await params).slug);
  if (!story) notFound();
  const pair = storyBySlug(story.pair)!;
  const data = await getStoryData(story.group);
  const order = NUMBERS_ORDER[story.group];
  const meta = {
    published: STORY_PUBLISHED,
    updated: 'Not updated',
    verified: FIGURES_AUDITED,
    audit: `Figures checked against USAspending, ${FIGURES_AUDITED}`,
  };

  if (!data) {
    return (
      <div data-v2 data-story={story.slug}>
        <StoryHeader kicker={STORY_KICKER} headline={story.headline} dek="The figures for this story could not be read from our database right now." meta={meta} byline={`By ${STORY_BYLINE}`} />
        <section className="border-t border-line py-9">
          <div className="mx-auto max-w-[1240px] px-8 max-md:px-4">
            <EmptyState title="Figures unavailable right now" action={{ href: INVESTIGATIONS_PATH, label: 'All investigations' }}>
              We print no figure we cannot read from the records. Please try again in a few minutes.
            </EmptyState>
          </div>
        </section>
      </div>
    );
  }

  const s = data.sentences;
  const rows = data.rows;
  const line = dateLine(data.retrieved);
  const changed = data.drift.length > 0 || !data.viewOk;
  const bezos = story.group === 'bezos';
  // G1: every printed sentence carries the number of the note that lists its official records (the first use anchors the back-link).
  const notes = storyNotes(story.group, rows, data.entities);
  const noteOf = new Map(notes.flatMap((n) => n.keys.map((k) => [k, n.n] as const)));
  const anchored = new Set<number>();
  const cite = (k: string) => {
    const n = noteOf.get(k);
    if (!n) return null;
    const first = !anchored.has(n);
    anchored.add(n);
    return <Cite n={n} anchor={first} />;
  };
  const sentence = (k: string) => (
    <p key={k} data-sentence={k}>
      {s[k]}
      {cite(k)}
    </p>
  );

  return (
    <div data-v2 data-story={story.slug} data-drift={changed ? data.drift.join(' ') || 'view' : ''}>
      {changed && (
        <div role="note" className="bg-stale-tint text-stale-ink">
          <div className="mx-auto max-w-[1240px] px-8 py-3 text-[14px] max-md:px-4">
            <b className="font-extrabold">Figures changed since the audit of {FIGURES_AUDITED}.</b> The records behind this page were reloaded and at least one figure below no longer matches the audited text. We are re-checking it.
          </div>
        </div>
      )}

      <StoryHeader
        kicker={STORY_KICKER}
        headline={story.headline}
        dek={
          <span data-sentence={order.dek}>
            {s[order.dek]}
            {cite(order.dek)}
          </span>
        }
        meta={meta}
        byline={`By ${STORY_BYLINE} · ${STORY_PUBLISHED}`}
      >
        <div className="mt-4 max-w-[760px] space-y-2 rounded-xl border border-line bg-card p-4 font-sans text-[14.5px] leading-relaxed" data-under-dek>
          <p>{CAVEAT_OBLIGATIONS}</p>
          {order.underDek.map(sentence)}
          <p className="text-[13px] text-muted">{line}</p>
        </div>
      </StoryHeader>

      <StorySection
        kicker="Why these companies"
        title="How this subject was chosen"
        rail={
          <RailNote title="The matched counterpart">
            <Link href={storyPath(pair.slug)} className={link}>{pair.headline}</Link>
          </RailNote>
        }
      >
        {(() => {
          const [a, sel, b, c] = whyLines(story, pair);
          const [before, after] = c.split(pair.phrase);
          return (
            <>
              <p>{a}</p>
              <p data-why-subject>{sel}</p>
              <p>{b}</p>
              {story.tie && (
                <p key="tie" data-sentence="tie">
                  {story.tie}
                  {cite('tie')}
                </p>
              )}
              <p data-why-pair>
                {before}
                <Link href={storyPath(pair.slug)} className={link}>{pair.phrase}</Link>
                {after}
              </p>
            </>
          );
        })()}
      </StorySection>

      <StorySection
        kicker="The numbers"
        title="What the award records show"
        rail={
          <>
            <RailNote title="Read these figures with">
              <ul className="list-disc space-y-1.5 pl-4">
                {caveats(story).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </RailNote>
            <RailNote title="As of">{line}</RailNote>
          </>
        }
      >
        {order.body.map(sentence)}
        {order.nulls.map(sentence)}

        <StoryFigure id="by-type" title="Net obligations by award type and fiscal year" note={<p>{line} {typeTableNote(story.group, rows)}</p>}>
          <FyTable rows={categoryTable(rows)} labelHead="Award type" withShare />
        </StoryFigure>

        <StoryFigure
          id="by-agency"
          title="Contract obligations by awarding agency and fiscal year"
          note={
            <>
              <p>{line} Agency and office names are as recorded on each transaction. Indented rows are offices within the agency above.</p>
              <p>&ldquo;Coded not competed&rdquo; is the share of obligations the awarding agency coded B, C, G or NDO in the extent-competed field. It is shown only for rows of $1 million or more, where it lies between 0 and 100 percent.</p>
              {bezos && sentence('z5')}
            </>
          }
        >
          <FyTable rows={agencyTable(rows)} labelHead="Agency" withShare />
        </StoryFigure>

        <StoryFigure
          id="by-recipient"
          title="Contract obligations by recipient"
          note={
            <>
              <p>{line} Each recipient is a UEI on the entity list below.</p>
              {bezos && sentence('z5')}
            </>
          }
        >
          <RecipientTable rows={recipientTable(rows)} />
        </StoryFigure>

        <StoryFigure
          id="largest"
          title="Largest awards in the period (contracts and indefinite-delivery vehicles)"
          note={
            <>
              <p>{line} Each award ID opens its USAspending award page. &ldquo;Competition, as coded&rdquo; is the extent-competed field and the justification the agency recorded, from the award&rsquo;s latest transaction in the period.</p>
              {bezos && <p>The USAspending award page for 80MSFC23CA014 now names Blue Origin Manufacturing, LLC as the recipient; the obligations in this table are the ones recorded under Blue Origin Washington, LLC.</p>}
            </>
          }
        >
          <AwardsTable rows={largestAwards(rows, 5)} />
        </StoryFigure>

        <div className="rounded-2xl border border-line bg-card p-5 font-sans text-[15px] leading-relaxed max-md:p-4" id="how" data-how-box>
          <h3 className="text-[18px] font-extrabold">How we got these numbers</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <b>Source:</b> {line} We downloaded every prime-award transaction for the listed UEIs from the public USAspending API and summed the obligation on each one, net of reductions.
            </li>
            <li>
              <b>Entity list, by ID:</b> {ENTITY_RULE_LINE} Every decision, with the reason and an evidence link, is in{' '}
              <a href={ENTITY_CSV_PATH} download className={link}>the entity decision log (CSV)</a>.
            </li>
            <li>
              <b>Pre-registration:</b> {preregLine(story)}
            </li>
          </ul>
          <h4 className="mt-4 text-[15px] font-extrabold">Entities counted on this page</h4>
          <ul className="mt-2 space-y-1 text-[14px]" data-entities>
            {data.entities
              .filter((e) => e.decision === 'include' && e.uei)
              .map((e) => (
                <li key={e.uei!}>
                  <a href={e.evidence_url} className={link}>{e.entity_name}</a> <span className="font-mono text-[13px] text-muted">{e.uei}</span>
                </li>
              ))}
          </ul>
          <h4 className="mt-4 text-[15px] font-extrabold">How we built the list</h4>
          <div className="mt-2 space-y-2 text-[14px]">
            {howBuilt(story.group, rows).map((p) => (
              <p key={p.text}>
                {p.text}
                {p.links?.map((l) => (
                  <span key={l.href}>
                    {' '}
                    <a href={l.href} className={link}>{l.label}</a>
                  </span>
                ))}
              </p>
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">The saved query</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-neutral-tint p-3 font-mono text-[12.5px] leading-relaxed" tabIndex={0} aria-label="The saved query">{savedQuery(story.group)}</pre>
            <p className="mt-2 text-[13.5px] text-muted">
              The same totals can be rebuilt on usaspending.gov with Advanced Search: prime awards, the recipient UEIs listed above, action dates 2023-10-01 to 2026-09-30.
            </p>
          </details>
        </div>
      </StorySection>

      <StorySection kicker="Limits" title="What these records don't show">
        <ul className="list-disc space-y-2 pl-6">
          {caveats(story).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p>{CONTEXT_LINE}</p>
        <p>{NOT_CAUSE_LINE}</p>
      </StorySection>

      <StorySection kicker="Response" title="Response from the companies">
        <StoryResponse companies={story.asked} />
      </StorySection>

      <section className="border-t border-line py-9 max-md:py-7" aria-labelledby="records">
        <div className="mx-auto max-w-[1240px] px-8 max-md:px-4">
          <div className="max-w-[760px] font-sans">
            <h2 id="records" className="text-[24px] font-extrabold max-md:text-[21px]">The records behind each figure</h2>
            <p className="mt-1 text-[14px] text-muted">{line}</p>
            <ol className="mt-4 space-y-3 text-[14.5px]" data-notes>
              {notes.map((n) => (
                <li key={n.n} id={`fn-${n.n}`} className="flex scroll-mt-6 gap-3">
                  <span className="w-6 flex-none text-right font-mono font-medium text-muted">{n.n}.</span>
                  <div className="min-w-0">
                    <p>
                      {n.text}{' '}
                      <a href={`#ref-${n.n}`} className={link} aria-label={`Back to footnote ${n.n} in the text`}>↩</a>
                    </p>
                    <ul className="mt-1 space-y-0.5 text-[13.5px]">
                      {n.links.map((l) => (
                        <li key={l.href + l.label}>
                          <a href={l.href} className={link}>{l.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <StoryFooter corrections={<p>None.</p>} />
    </div>
  );
}
