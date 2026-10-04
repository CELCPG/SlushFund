import Link from 'next/link';
import { sentence } from '@/components/v2/AwardsTable';
import FilingLink from '@/components/v2/FilingLink';
import { MoneyIcon } from '@/components/v2/MoneyChip';
import { partyLetter } from '@/components/v2/TradesTable';
import { companySlug } from '@/lib/v2/companies';
import { dateFlagNote } from '@/lib/v2/date-flags';
import { fmtDate, fmtRange, fmtUsd } from '@/lib/v2/format';
import { instrumentKind, optionDetail, ownerLabel, tradeSentence } from '@/lib/v2/instruments';
import type { LatestItem } from '@/lib/v2/latest';

function TradeItem({ item }: { item: Extract<LatestItem, { kind: 'trade' }> }) {
  const t = item.trade;
  const range = fmtRange(t.amount_min, t.amount_max, t.amount_range);
  const owner = ownerLabel(t.owner);
  const kind = instrumentKind(t);
  const detail = kind === 'option' ? optionDetail(t) : null;
  const amended = t.filed_date && t.filed_date !== item.date ? t.filed_date : null;
  const flag = dateFlagNote(t.date_flag);
  return (
    <li id={`trade-${t.id}`} className="rounded-2xl bg-card p-4 shadow-card" data-kind="trade">
      <div className="flex items-start gap-3">
        <MoneyIcon type="trades" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-semibold leading-snug">
            {t.bio_guide_id
              ? <Link href={`/people/${t.bio_guide_id}`} className="font-bold hover:underline">{t.member_name}</Link>
              : <b>{t.member_name}</b>}
            <span className="font-normal text-muted"> ({partyLetter(t.member_party)}-{t.member_state}, {t.member_chamber})</span>
            : {tradeSentence(t)}
          </h3>
          <p className="mt-0.5 text-[13.5px] text-muted">
            <span className="font-mono text-[13px] text-ink">{t.ticker}</span> {t.company_name}
            {kind !== 'stock' && <> · Asset type as filed: {t.asset_type || 'not stated'}{detail ? ` · ${detail}` : ''}</>}
          </p>
          <p className="mt-1.5 text-[13.5px]">
            <span>{range ?? <span className="text-muted">Amount not disclosed</span>}</span>
            {owner && <span className="text-muted"> · owner: {owner}</span>}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            Traded {fmtDate(t.transaction_date)} · first reported {fmtDate(item.date)}
            {amended && <> · amended {fmtDate(amended)}</>}
          </p>
          {flag && <p className="mt-1.5 text-[12.5px]"><span className="rounded-md bg-stale-tint px-1.5 py-0.5 text-stale-ink">{flag}</span></p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <FilingLink href={t.disclosure_url} source={t.source_system === 'House_Clerk' ? 'House Clerk PTR' : t.source_system === 'Senate_EFD' ? 'Senate eFD report' : t.source_system} />
            {amended && <span className="text-[12px] text-muted">opens the amended report</span>}
          </p>
        </div>
      </div>
    </li>
  );
}

function AwardItem({ item }: { item: Extract<LatestItem, { kind: 'award' }> }) {
  const a = item.award;
  const parentKey = a.recipient_parent_uei || a.recipient_uei;
  const parentName = (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name;
  const extent = sentence(a.extent_competed);
  return (
    <li id={`award-${a.id}`} className="rounded-2xl bg-card p-4 shadow-card" data-kind="award">
      <div className="flex items-start gap-3">
        <MoneyIcon type="contracts" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-semibold leading-snug">
            {parentKey && parentName
              ? <Link href={`/companies/${companySlug(parentKey, parentName)}`} className="font-bold text-contracts-ink hover:underline">{a.recipient_name}</Link>
              : <b>{a.recipient_name}</b>}
            <span className="font-normal text-muted">: contract award</span>
          </h3>
          {a.description && <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted" title={a.description}>{a.description}</p>}
          <p className="mt-1.5 text-[13.5px]">
            {a.obligated_amount == null
              ? <span className="text-muted">Obligated amount unavailable</span>
              : <><b>{fmtUsd(a.obligated_amount)}</b> <span className="text-muted">obligated to date</span></>}
            {extent && <span className="text-muted"> · {extent}</span>}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {a.awarding_agency_code
              ? <Link href={`/agencies/${a.awarding_agency_code}`} className="hover:underline">{a.awarding_agency}</Link>
              : (a.awarding_agency ?? 'Agency not stated')}
            {' · '}signed {fmtDate(item.date)}{a.fiscal_year ? ` · FY${a.fiscal_year}` : ''}
            {a.award_id && <> · <span className="font-mono text-[12.5px]">{a.award_id}</span></>}
          </p>
          <p className="mt-2"><FilingLink href={a.usaspending_url} source="USAspending award page" label="USAspending" /></p>
        </div>
      </div>
    </li>
  );
}

/** Newest first, under one heading per day. */
export default function LatestFeedList({ items }: { items: LatestItem[] }) {
  const days: { date: string; items: LatestItem[] }[] = [];
  for (const it of items) {
    const last = days[days.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else days.push({ date: it.date, items: [it] });
  }
  return (
    <div className="space-y-6">
      {days.map((d) => (
        <section key={d.date} aria-label={fmtDate(d.date) ?? d.date}>
          <h2 className="mb-2 font-display text-[18px] font-extrabold">{fmtDate(d.date)}</h2>
          <ul className="space-y-2.5">
            {d.items.map((it) => it.kind === 'trade'
              ? <TradeItem key={`t-${it.id}`} item={it} />
              : <AwardItem key={`a-${it.id}`} item={it} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
