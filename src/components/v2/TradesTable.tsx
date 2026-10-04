import Link from 'next/link';
import type { ReactNode } from 'react';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import FilingLink from '@/components/v2/FilingLink';
import type { TradeRow } from '@/lib/v2/queries';
import { fmtDate, fmtDateShort, fmtRange } from '@/lib/v2/format';
import { dateFlagNote } from '@/lib/v2/date-flags';
import { filingLinks } from '@/lib/v2/filing-links';
import { instrumentKind, optionDetail, ownerLabel, typeLabel } from '@/lib/v2/instruments';

/** Party is text, never a color (design rule 1). */
export function partyLetter(p: string | null | undefined): string {
  const v = (p ?? '').toLowerCase();
  if (v.startsWith('rep')) return 'R';
  if (v.startsWith('dem')) return 'D';
  if (v.startsWith('ind')) return 'I';
  return p || '?';
}

const COLUMNS: DataTableColumn[] = [
  { key: 'member', header: 'Member', mobile: 'title' },
  { key: 'party', header: 'Party', csvOnly: true },
  { key: 'state', header: 'State', csvOnly: true },
  { key: 'chamber', header: 'Chamber', csvOnly: true },
  { key: 'owner', header: 'Owner', csvOnly: true },
  { key: 'asset', header: 'Asset', mobile: 'subtitle' },
  { key: 'asset_type', header: 'Asset type (as filed)', csvOnly: true },
  { key: 'type', header: 'Type' },
  { key: 'amount', header: 'Amount (range)', numeric: true, sortKey: 'amount_min' },
  // On screen one column carries traded → filed (sorted by filing date).
  { key: 'dates', header: 'Traded → filed', numeric: true, sortKey: 'filed_sort', csv: false },
  { key: 'traded', header: 'Traded', csvOnly: true },
  { key: 'filed', header: 'Filed (first report)', csvOnly: true },
  { key: 'amended', header: 'Amended report filed', csvOnly: true },
  { key: 'amendment_url', header: 'Amended report (link)', csvOnly: true },
  { key: 'date_note', header: 'Date note', csvOnly: true },
  { key: 'filing', header: 'Filing', sortable: false, mobile: 'action' },
];

/** On a member's own page the member column is noise: the owner moves into the asset cell. */
const MEMBER_PAGE_COLUMNS: DataTableColumn[] = COLUMNS.map((c) =>
  c.key === 'member' ? { ...c, csvOnly: true, mobile: 'hidden' as const } : c.key === 'asset' ? { ...c, mobile: 'title' as const } : c,
);

function sourceName(system: string): string {
  if (system === 'House_Clerk') return 'House Clerk PTR';
  if (system === 'Senate_EFD') return 'Senate eFD report';
  return system;
}

/**
 * Trades as a DataTable: ranges stay ranges, traded → filed dates, and "View filing" on every row.
 * Options read "Bought put options" (never "Purchase"), other instruments say what they are, owner
 * "Self" reads "Self (incl. trusts/accounts)" (A7 H1), and a row with a date flag carries the reader wording
 * from date-flags.ts and sorts last. Days-to-file is not shown until R6a's lateness is audited (A7 S2).
 */
export default function TradesTable({
  trades,
  caption,
  csvName,
  hideMember = false,
  linkMembers = true,
  ordered = false,
  fullDates = false,
  captionHidden = false,
  footer,
}: {
  trades: TradeRow[];
  caption: string;
  csvName?: string;
  /** On /people/[bioguide]: no member column on screen (still in the CSV). */
  hideMember?: boolean;
  /** Link each member to /people/[bioguide]. */
  linkMembers?: boolean;
  /** The rows arrive in the order the page chose (a server-side sort and page): no column sorting, no page-only CSV. */
  ordered?: boolean;
  /** Dates with their year on two lines (Traded / Filed): for lists that span several years. */
  fullDates?: boolean;
  captionHidden?: boolean;
  footer?: ReactNode;
}) {
  const rows: DataTableRow[] = trades.map((t) => {
    const range = fmtRange(t.amount_min, t.amount_max, t.amount_range);
    const who = `${partyLetter(t.member_party)} · ${t.member_state} · ${t.member_chamber}`;
    const owner = ownerLabel(t.owner, t.member_chamber);
    const kind = instrumentKind(t);
    const detail = kind === 'option' ? optionDetail(t) : null;
    const flagged = !!t.date_flag;
    // R6a: when an amendment replaced the row, filed_date is the amendment's date and
    // original_filed_date the first report's. Show the first report; note the amendment.
    const filed = t.original_filed_date ?? t.filed_date;
    const amended = t.original_filed_date && t.filed_date && t.filed_date !== t.original_filed_date ? t.filed_date : null;
    // N9: the main link is the first report; a later amendment is a second link.
    const links = filingLinks(t);
    return {
      id: t.id,
      values: {
        member: t.member_name,
        party: partyLetter(t.member_party),
        state: t.member_state,
        chamber: t.member_chamber,
        asset: `${t.ticker} ${t.company_name}`.trim(),
        asset_type: t.asset_type,
        type: typeLabel(t),
        owner,
        amount_min: t.amount_min,
        // CSV keeps the disclosed text verbatim (lots included).
        amount: t.amount_range ?? range,
        traded: t.transaction_date,
        filed,
        amended,
        // Flagged dates never drive sorting: they sort last.
        filed_sort: flagged ? null : filed,
        date_note: dateFlagNote(t.date_flag),
        filing: links.first,
        amendment_url: links.amendment,
      },
      cells: {
        member: (
          <span className="block min-w-0">
            {linkMembers && t.bio_guide_id
              ? <Link href={`/people/${t.bio_guide_id}`} className="font-semibold hover:underline">{t.member_name}</Link>
              : <b className="font-semibold">{t.member_name}</b>}
            <span className="block text-[12.5px] font-normal text-muted">{who}{owner ? ` · owner: ${owner}` : ''}</span>
          </span>
        ),
        asset: (
          <span className="block min-w-0 sm:max-w-[260px]" title={t.company_name}>
            <span className="font-mono text-[13px] font-medium">{t.ticker}</span>{' '}
            <span className="text-[13px] text-muted sm:line-clamp-1">{t.company_name}</span>
            {kind !== 'stock' && (
              <span className="mt-0.5 block text-[12px] text-muted">Asset type as filed: {t.asset_type || 'not stated'}{detail ? ` · ${detail}` : ''}</span>
            )}
            {hideMember && owner && <span className="mt-0.5 block text-[12px] text-muted">Owner: {owner}</span>}
          </span>
        ),
        type: kind === 'option'
          ? <span className="rounded-md bg-trades-tint px-1.5 py-0.5 text-[13px] font-semibold text-trades-ink">{typeLabel(t)}</span>
          : <span>{typeLabel(t)}</span>,
        // Mixed same-day lots go one range group per line so a 12-lot row can't widen the table.
        amount: range
          ? range.includes(' + ')
            ? <span className="block">{range.split(' + ').map((g, i) => <span key={i} className="block">{i ? '+ ' : ''}{g}</span>)}</span>
            : <span>{range}</span>
          : <span className="text-muted">Not disclosed</span>,
        dates: (
          <span className="block">
            {fullDates ? (
              <span className="block whitespace-nowrap text-left">
                <span className="block"><span className="font-sans text-[11.5px] text-muted">Traded</span> {fmtDate(t.transaction_date)}</span>
                <span className="block"><span className="font-sans text-[11.5px] text-muted">Filed</span> {fmtDate(filed) ?? '—'}</span>
              </span>
            ) : (
              <span title={`Traded ${fmtDate(t.transaction_date)}, filed ${fmtDate(filed) ?? 'date unknown'}`}>
                {fmtDateShort(t.transaction_date)} → {fmtDateShort(filed) ?? '—'}
              </span>
            )}
            {amended && <span className="mt-0.5 block font-sans text-[12px] text-muted">amended {fmtDateShort(amended)}</span>}
            {flagged && (
              <span className="mt-0.5 block font-sans text-[12px]">
                <span className="rounded-md bg-stale-tint px-1.5 py-0.5 text-stale-ink">{dateFlagNote(t.date_flag)}</span>
              </span>
            )}
          </span>
        ),
        filing: (
          <span className="flex flex-col items-start gap-0.5">
            <FilingLink href={links.first} source={`${sourceName(t.source_system)}${links.amendment ? ', first report' : ''}`} />
            {links.amendment && <FilingLink href={links.amendment} label="Amended report" source={`${sourceName(t.source_system)}, amended report`} className="text-[12px] font-medium" />}
          </span>
        ),
      },
    };
  });

  const columns = (hideMember ? MEMBER_PAGE_COLUMNS : COLUMNS).map((c) => (ordered ? { ...c, sortable: false } : c));
  return (
    <DataTable
      columns={columns}
      rows={rows}
      caption={caption}
      captionHidden={captionHidden}
      initialSort={ordered ? undefined : { key: 'filed_sort', dir: 'desc' }}
      csv={csvName && !ordered ? { filename: csvName } : undefined}
      footer={footer ?? (
        <span>
          Source: House Clerk PTRs and Senate eFD. Amounts are disclosed ranges; “2 ×” means two same-day lots, each in that range. “Filed” is the first report; a later amendment is noted under it and linked beside the filing. In House filings, owner “Self” includes
          trusts and accounts filed without an owner. Options are labelled as options, never as a purchase or sale of the stock.
        </span>
      )}
    />
  );
}
