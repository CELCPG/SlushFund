import Link from 'next/link';
import { reportErrorHref } from '@/lib/v2/error-reports';
import EmptyState from '@/components/v2/EmptyState';
import { Card } from '@/components/v2/PageBand';
import SimplePage from '@/components/v2/SimplePage';

// D5: the old index listed the 17 withdrawn stories as cards. Until a story passes the audit
// again, this page says so. Add story cards here only for stories with an Auditor GO.
const RULES = [
  { title: 'A source for every figure', text: 'Each number carries a numbered footnote to the official record it came from: a filing, an award page, a statute.' },
  { title: 'A last-verified date', text: 'Every story shows when its figures were last checked against the source, and says so when they change.' },
  { title: 'Patterns, not accusations', text: 'We describe what the records show. A sequence of events is not proof of wrongdoing, and we say that where it applies.' },
  { title: 'Errors are logged', text: 'When a story is wrong we fix it and record the change in the public corrections log.' },
];

export default function InvestigationsPage() {
  return (
    <SimplePage
      eyebrow="Investigations"
      title="Stories return one at a time, after every figure is checked"
      dek="We took our earlier stories down to re-verify them against official records. Each comes back only when its numbers have a cited public source."
    >
      <EmptyState
        title="No stories are published right now"
        icon="✎"
        action={{ href: '/about/corrections', label: 'Read why stories were withdrawn' }}
      >
        The data pages stay open in the meantime: every trade and contract links to the filing it came from.
      </EmptyState>
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
