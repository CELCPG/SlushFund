import Link from 'next/link';
import { reportErrorHref } from '@/lib/v2/error-reports';
import EmptyState from '@/components/v2/EmptyState';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';
import { IRAN_WAR_PATH, investigationsV2Enabled, iranWarStoryLive } from '@/lib/v2/flags';
import { DRAFT_UNTIL_AW1, IRAN_WAR_BYLINE, IRAN_WAR_HEADLINE, IRAN_WAR_STORY_DATE } from '@/lib/v2/iran-war-copy';
import { STORY_PAIRS, STORY_PUBLISHED, storyBySlug, storyPath } from '@/lib/v2/story-figures';

// D5: the old index listed the 17 withdrawn stories as cards. Until a story passes the audit
// again, this page says so. Add story cards here only for stories with an Auditor GO.
// D12: the four investigation posts are listed in their matched pairs (G8) while SHOW_INVESTIGATIONS_V2 is on.
const RULES = [
  { title: 'A source for every figure', text: 'Each sentence with a figure carries a numbered note to the records behind it: an award page, a recipient record or an SEC filing.' },
  { title: 'A last-verified date', text: 'Every story shows when its figures were last checked against the source, and says so when they change.' },
  { title: 'Patterns, not accusations', text: 'We describe what the records show. A sequence of events is not proof of wrongdoing, and we say that where it applies.' },
  { title: 'Errors are logged', text: 'When a story is wrong we fix it and record the change in the public corrections log.' },
];

export default function InvestigationsPage() {
  const on = investigationsV2Enabled();
  // W2: the Iran war story has its own flag and card; it also stays off while its copy is a draft on production.
  const iran = iranWarStoryLive(DRAFT_UNTIL_AW1);
  return (
    <SimplePage
      eyebrow="Investigations"
      title="Stories return only after every figure is checked"
      dek="We took our earlier stories down to re-verify them against official records. Each comes back only when its numbers have a cited public source."
    >
      {iran && (
        <section aria-labelledby="iran-war-story" className="mb-8" data-iran-war-card>
          <h2 id="iran-war-story" className="mb-1 font-display text-[26px] font-extrabold max-md:text-[22px]">OGE financial disclosure records</h2>
          <Card as="section">
            <Link href={IRAN_WAR_PATH} className="font-display text-[19px] font-extrabold leading-tight text-trades-ink hover:underline">{IRAN_WAR_HEADLINE}</Link>
            <p className="mt-1 text-[13.5px] text-muted">By {IRAN_WAR_BYLINE} · {IRAN_WAR_STORY_DATE}</p>
          </Card>
        </section>
      )}
      {on ? (
        <section aria-labelledby="published-stories">
          <h2 id="published-stories" className="mb-1 font-display text-[26px] font-extrabold max-md:text-[22px]">Federal contract records, fiscal years 2024–2026</h2>
          <p className="mb-4 text-[15px] text-muted">Each pair of pages uses identical measures, window, wording and caveats, and both pages of a pair are published together.</p>
          <div className="grid gap-4">
            {STORY_PAIRS.map((pair, i) => (
              <Card key={pair.join()} as="section">
                <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-muted">Matched pair {i + 1}</h3>
                <ul className="mt-2 grid grid-cols-2 gap-4 max-md:grid-cols-1" data-story-pair={i + 1}>
                  {pair.map((slug) => {
                    const s = storyBySlug(slug)!;
                    return (
                      <li key={slug}>
                        <Link href={storyPath(slug)} className="font-display text-[19px] font-extrabold leading-tight text-trades-ink hover:underline">{s.headline}</Link>
                        <p className="mt-1 text-[13.5px] text-muted">By SlushFund · {STORY_PUBLISHED}</p>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ) : iran ? null : (
        <EmptyState
          title="No stories are published right now"
          icon="✎"
          action={{ href: '/about/corrections', label: 'Read why stories were withdrawn' }}
        >
          The data pages stay open in the meantime: every trade and contract links to the filing it came from.
        </EmptyState>
      )}
      <h2 className="mb-3 mt-10 font-display text-[26px] font-extrabold max-md:text-[22px]">The standard a story has to meet</h2>
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {RULES.map((r) => (
          <Card key={r.title}>
            <h3 className="font-display text-[18px] font-extrabold leading-tight">{r.title}</h3>
            <p className="mt-2 text-[14.5px] text-muted">{r.text}</p>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-[14px] text-muted">
        See <Link href="/about/methodology" className="font-semibold text-trades-ink hover:underline">how each dataset is built</Link>, or <Link href={reportErrorHref('/investigations')} className="font-semibold text-trades-ink hover:underline">report an error</Link>.
      </p>
    </SimplePage>
  );
}
