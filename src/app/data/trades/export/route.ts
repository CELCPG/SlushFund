import { toCsv, csvFilename } from '@/lib/v2/csv';
import { dateFlagNote } from '@/lib/v2/date-flags';
import { EXPORT_ROW_CAP, type SP } from '@/lib/v2/explorer';
import { filingLinks } from '@/lib/v2/filing-links';
import { instrumentKind, ownerLabel, typeLabel } from '@/lib/v2/instruments';
import { getTradesForExport, parseTradeFilters } from '@/lib/v2/trades-explorer';

/**
 * CSV of the trades matching the same query string as /data/trades, in the same order, up to the row
 * cap. Every row carries the official filing's address (filing_url). The response headers say how
 * many rows matched and how many are in the file.
 */
export async function GET(request: Request) {
  const sp: SP = Object.fromEntries(new URL(request.url).searchParams.entries());
  const f = parseTradeFilters(sp);
  const result = await getTradesForExport(f);
  if (!result) {
    return new Response('The trades database did not answer. Try again in a few minutes.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' },
    });
  }
  const kindLabel = { stock: 'Stock', option: 'Option', other: 'Other asset' } as const;
  const headers = [
    ['member_name', 'Member'], ['bioguide_id', 'Bioguide ID'], ['chamber', 'Chamber'], ['party', 'Party'], ['state', 'State'],
    ['owner', 'Owner'], ['ticker', 'Ticker'], ['company_name', 'Company or asset'], ['asset_type_as_filed', 'Asset type (as filed)'],
    ['instrument', 'Instrument'], ['transaction', 'Transaction'], ['transaction_code', 'Transaction code'],
    ['option_type', 'Option type'], ['strike', 'Option strike'], ['expiry', 'Option expiry'],
    ['amount_range', 'Amount (disclosed range)'], ['lot_count', 'Same-day lots'],
    ['traded', 'Trade date'], ['first_report_filed', 'First report filed'], ['amendment_filed', 'Amendment filed (blank if none)'],
    ['date_flag', 'Date flag'], ['date_note', 'Date note'], ['source', 'Source'], ['filing_url', 'Filing URL (first report)'], ['amendment_url', 'Amendment URL (blank if none)'],
  ].map(([key, label]) => ({ key, label }));
  const rows = result.rows.map((t) => ({
    member_name: t.member_name,
    bioguide_id: t.bio_guide_id,
    chamber: t.member_chamber,
    party: t.member_party,
    state: t.member_state,
    owner: ownerLabel(t.owner, t.member_chamber),
    ticker: t.ticker,
    company_name: t.company_name,
    asset_type_as_filed: t.asset_type,
    instrument: kindLabel[instrumentKind(t)],
    transaction: typeLabel(t),
    transaction_code: t.transaction_type,
    option_type: t.option_type,
    strike: t.strike,
    expiry: t.expiry,
    amount_range: t.amount_range,
    lot_count: t.lot_count,
    traded: t.transaction_date,
    first_report_filed: t.original_filed_date ?? t.filed_date,
    amendment_filed: filingLinks(t).amendment ? t.filed_date : null,
    date_flag: t.date_flag,
    date_note: dateFlagNote(t.date_flag),
    source: t.source_system === 'House_Clerk' ? 'House Clerk PTR' : t.source_system === 'Senate_EFD' ? 'Senate eFD report' : t.source_system,
    filing_url: filingLinks(t).first,
    amendment_url: filingLinks(t).amendment,
  }));
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('slushfund-congress-trades')}"`,
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      'X-Rows-Matched': String(result.total),
      'X-Rows-Exported': String(rows.length),
      'X-Row-Cap': String(EXPORT_ROW_CAP),
    },
  });
}
