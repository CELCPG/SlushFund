import Link from 'next/link';
import DataTable, { type DataTableColumn, type DataTableRow } from '@/components/v2/DataTable';
import FilingLink from '@/components/v2/FilingLink';
import { companySlug, type AwardRow } from '@/lib/v2/companies';
import { fmtDate, fmtUsd } from '@/lib/v2/format';

const KEEP_UPPER = new Set(['far', 'sap', 'ndo', 'ii', 'iii', 'iv', 'usa']);

/** USAspending labels are upper case ("NOT COMPETED"): sentence case, acronyms kept. */
export function sentence(v: string | null | undefined): string | null {
  if (!v) return null;
  const words = v.toLowerCase().split(/(\s+)/).map((w) => (KEEP_UPPER.has(w.replace(/[^a-z]/g, '')) ? w.toUpperCase() : w));
  const s = words.join('');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plain(v: string | null | undefined): string | null {
  return v ? v.replace(/\s+/g, ' ').trim() : null;
}

/**
 * Awards as a DataTable. Amounts are obligated to date on awards signed in
 * the FY (never "spending in FY"). Every row links to its USAspending page.
 *
 * mode "company": shows the agency, and the recipient when it differs from
 *   the group name (a subsidiary or another recipient record).
 * mode "agency": shows the recipient, linked to its company page.
 * mode "explorer": shows both (the data explorer lists awards from every company and agency).
 * A PIID is never unique, so an order's parent IDV PIID is shown beside it (A7 §f).
 */
export default function AwardsTable({
  awards,
  mode,
  groupName,
  caption,
  csvName,
  footer,
  ordered = false,
  captionHidden = false,
}: {
  awards: AwardRow[];
  mode: 'company' | 'agency' | 'explorer';
  groupName?: string;
  caption: string;
  csvName: string;
  footer?: React.ReactNode;
  /** The rows arrive in the order the page chose (server-side sort and page): no column sorting, no page-only CSV. */
  ordered?: boolean;
  captionHidden?: boolean;
}) {
  const showRecipient = mode !== 'company' || awards.some((a) => (a.recipient_name ?? '').trim() !== (groupName ?? '').trim());

  const baseColumns: DataTableColumn[] = [
    { key: 'award', header: 'Award', mobile: 'title', sortKey: 'piid' },
    ...(showRecipient ? [{ key: 'recipient', header: 'Recipient', mobile: 'subtitle' as const }] : []),
    ...(mode !== 'agency' ? [{ key: 'agency', header: 'Agency', mobile: 'field' as const }] : []),
    { key: 'signed', header: 'Signed', mobile: 'field', sortKey: 'signed_iso' },
    { key: 'competition', header: 'Competition', mobile: 'field' },
    { key: 'obligated', header: 'Obligated to date', numeric: true, mobile: 'field' },
    { key: 'link', header: 'Source', sortable: false, mobile: 'action', csv: false },
    { key: 'fy', header: 'Fiscal year signed', csvOnly: true },
    { key: 'agency_code', header: 'Agency code', csvOnly: true },
    { key: 'description_full', header: 'Description', csvOnly: true },
    { key: 'extent_code', header: 'Extent competed', csvOnly: true },
    { key: 'usaspending_url', header: 'USAspending URL', csvOnly: true },
  ];
  const columns = ordered ? baseColumns.map((c) => ({ ...c, sortable: false })) : baseColumns;

  const rows: DataTableRow[] = awards.map((a) => {
    const signed = a.date_signed ?? a.posted_date;
    const extent = sentence(a.extent_competed);
    const why = sentence(plain(a.other_than_full_open));
    const parentKey = a.recipient_parent_uei || a.recipient_uei;
    const parentName = (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name;
    return {
      id: a.id,
      values: {
        award: a.award_id,
        piid: a.award_id,
        parent_piid: a.parent_award_piid ?? null,
        recipient: a.recipient_name,
        agency: [a.awarding_agency, a.awarding_sub_agency].filter(Boolean).join(' / ') || null,
        signed: signed ? fmtDate(signed) : null,
        signed_iso: signed,
        competition: [extent, why].filter(Boolean).join(' — ') || null,
        obligated: a.obligated_amount,
        fy: a.fiscal_year,
        agency_code: a.awarding_agency_code,
        description_full: a.description,
        extent_code: a.extent_competed,
        usaspending_url: a.usaspending_url,
      },
      cells: {
        award: (
          <span className="block min-w-0">
            <span className="font-mono text-[13px] font-medium">{a.award_id ?? '—'}</span>
            {a.parent_award_piid && <span className="block text-[12px] font-normal text-muted">Order under IDV <span className="font-mono">{a.parent_award_piid}</span></span>}
            {a.description && <span className="line-clamp-2 text-[12.5px] font-normal text-muted" title={a.description}>{a.description}</span>}
          </span>
        ),
        recipient: parentKey && parentName && mode !== 'company'
          ? <Link href={`/companies/${companySlug(parentKey, parentName)}`} className="font-semibold text-contracts-ink hover:underline">{a.recipient_name}</Link>
          : <span>{a.recipient_name}</span>,
        agency: a.awarding_agency_code
          ? <Link href={`/agencies/${a.awarding_agency_code}`} className="text-[13.5px] hover:underline">{a.awarding_agency}</Link>
          : <span>{a.awarding_agency ?? '—'}</span>,
        signed: (
          <span className="block">
            {signed ? fmtDate(signed) : 'Unknown'}
            {a.fiscal_year && <span className="block text-[12px] text-muted">FY{a.fiscal_year}</span>}
          </span>
        ),
        competition: (
          <span className="block min-w-0 text-[13px]">
            {extent ?? <span className="text-muted">Not reported</span>}
            {why && <span className="line-clamp-2 text-[12px] text-muted" title={why}>{why}</span>}
          </span>
        ),
        obligated: a.obligated_amount == null ? <span className="font-sans text-muted">Unavailable</span> : <span>{fmtUsd(a.obligated_amount)}</span>,
        link: <FilingLink href={a.usaspending_url} source="USAspending award page" label="USAspending" />,
      },
    };
  });

  return (
    <DataTable
      columns={columns}
      rows={rows}
      caption={caption}
      captionHidden={captionHidden}
      initialSort={ordered ? undefined : { key: 'obligated', dir: 'desc' }}
      csv={ordered ? undefined : { filename: csvName }}
      footer={footer}
    />
  );
}
