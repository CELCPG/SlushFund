import Link from 'next/link';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import FilingLink from '@/components/v2/FilingLink';
import { dateFlagNote } from '@/lib/v2/date-flags';
import { partyLetter } from '@/components/v2/TradesTable';
import { fmtDate, fmtRange } from '@/lib/v2/format';
import { instrumentKind, ownerLabel, typeLabel } from '@/lib/v2/instruments';
import type { LateTrade } from '@/lib/v2/late-filers';

const COLUMNS: DataTableColumn[] = [
  { key: 'member', header: 'Member', mobile: 'title', sortable: false },
  { key: 'asset', header: 'Asset', mobile: 'subtitle', sortable: false },
  { key: 'gap', header: 'Days from trade to first report', numeric: true, sortable: false },
  { key: 'dates', header: 'Traded → first report', sortable: false },
  { key: 'type', header: 'Type', sortable: false },
  { key: 'amount', header: 'Amount (range)', numeric: true, sortable: false },
  { key: 'filing', header: 'Filing', sortable: false, mobile: 'action' },
];

/**
 * Trades ordered by the gap between the trade and its first report. The wording is factual: "filed N
 * days after the trade", with the filing one tap away. A row that
 * carries a date_flag is shown with the flag as a plain note, whatever its value.
 */
export default function LateFilersTable({ trades, caption, hideMember = false }: { trades: LateTrade[]; caption: string; hideMember?: boolean }) {
  const rows: DataTableRow[] = trades.map((t) => {
    const first = t.original_filed_date ?? t.filed_date;
    // D8c (A7c B2): the row links the FIRST report; a later filing that restated it is named beside it.
    const restated = t.original_source_doc_id && t.source_doc_id && t.original_source_doc_id !== t.source_doc_id
      ? { url: t.disclosure_url, filed: t.filed_date }
      : null;
    const firstUrl = t.original_disclosure_url ?? t.disclosure_url;
    const range = fmtRange(t.amount_min, t.amount_max, t.amount_range);
    const owner = ownerLabel(t.owner, t.member_chamber);
    const kind = instrumentKind(t);
    return {
      id: t.id,
      values: {
        member: t.member_name,
        asset: `${t.ticker} ${t.company_name}`.trim(),
        gap: t.days_to_file,
        dates: t.transaction_date,
        type: typeLabel(t),
        amount: t.amount_range ?? range,
        filing: firstUrl,
      },
      cells: {
        member: (
          <span className="block min-w-0">
            {t.bio_guide_id
              ? <Link href={`/people/${t.bio_guide_id}`} className="inline-flex min-h-6 items-center font-semibold hover:underline">{t.member_name}</Link>
              : <b className="font-semibold">{t.member_name}</b>}
            <span className="block text-[12.5px] font-normal text-muted">{partyLetter(t.member_party)} · {t.member_state} · {t.member_chamber}{owner ? ` · owner: ${owner}` : ''}</span>
          </span>
        ),
        asset: (
          <span className="block min-w-0 sm:max-w-[240px]" title={t.company_name}>
            <span className="font-mono text-[13px] font-medium">{t.ticker}</span>{' '}
            <span className="text-[13px] text-muted sm:line-clamp-1">{t.company_name}</span>
            {kind !== 'stock' && <span className="mt-0.5 block text-[12px] text-muted">Asset type as filed: {t.asset_type || 'not stated'}</span>}
            {hideMember && owner && <span className="mt-0.5 block text-[12px] text-muted">Owner: {owner}</span>}
          </span>
        ),
        gap: (
          <span className="block">
            <b className="font-mono text-[15px] font-semibold">{t.days_to_file.toLocaleString('en-US')} days</b>
            <span className="block font-sans text-[12px] font-normal text-muted">after the trade date shown in the filing (calendar days, not adjusted for weekends or holidays)</span>
          </span>
        ),
        dates: (
          <span className="block">
            <span className="block whitespace-nowrap">
              <span className="block"><span className="text-[11.5px] text-muted">Traded</span> {fmtDate(t.transaction_date)}</span>
              <span className="block"><span className="text-[11.5px] text-muted">First report</span> {fmtDate(first) ?? '—'}</span>
            </span>
            {restated?.filed && <span className="mt-0.5 block font-sans text-[12px] text-muted">restated {fmtDate(restated.filed)}</span>}
            {t.date_flag && (
              <span className="mt-0.5 block font-sans text-[12px]">
                <span className="rounded-md bg-stale-tint px-1.5 py-0.5 text-stale-ink">{dateFlagNote(t.date_flag)}</span>
              </span>
            )}
          </span>
        ),
        type: <span>{typeLabel(t)}</span>,
        amount: range
          ? range.includes(' + ')
            ? <span className="block">{range.split(' + ').map((g, i) => <span key={i} className="block">{i ? '+ ' : ''}{g}</span>)}</span>
            : <span>{range}</span>
          : <span className="text-muted">Not disclosed</span>,
        filing: (
          <span className="block">
            <FilingLink href={firstUrl} source={t.source_system === 'House_Clerk' ? 'House Clerk PTR' : t.source_system === 'Senate_EFD' ? 'Senate eFD report' : t.source_system} />
            {restated && (
              <span className="block max-w-[120px] whitespace-normal text-[11.5px] leading-snug text-muted">
                first report; restated in{' '}
                <FilingLink href={restated.url} label={restated.filed ? `${fmtDate(restated.filed)}` : 'a later filing'} source="House or Senate filing that restated it" className="text-[11.5px]" />
              </span>
            )}
          </span>
        ),
      },
    };
  });
  // Inside one member's report the member column is noise: it stays in the CSV, and the owner moves into the asset cell.
  const columns = hideMember
    ? COLUMNS.map((c) => (c.key === 'member' ? { ...c, csvOnly: true, mobile: 'hidden' as const } : c.key === 'asset' ? { ...c, mobile: 'title' as const } : c))
    : COLUMNS;
  return <DataTable columns={columns} rows={rows} caption={caption} captionHidden emptyMessage="No trades match." />;
}
