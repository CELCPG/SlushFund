import { companySlug } from '@/lib/v2/companies';
import { getContractsForExport, parseContractFilters } from '@/lib/v2/contracts-explorer';
import { csvFilename, toCsv } from '@/lib/v2/csv';
import { EXPORT_ROW_CAP, type SP } from '@/lib/v2/explorer';

/**
 * CSV of the non-competed awards matching the same query string as /data/contracts, in the same
 * order, up to the row cap. Every row carries its USAspending award page (award_page_url). The amount
 * is "obligated to date", exact, as of the last load (loaded_through).
 */
export async function GET(request: Request) {
  const sp: SP = Object.fromEntries(new URL(request.url).searchParams.entries());
  const f = parseContractFilters(sp);
  const result = await getContractsForExport(f);
  if (!result) {
    return new Response('The contracts database did not answer. Try again in a few minutes.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' },
    });
  }
  const headers = [
    ['piid', 'PIID'], ['parent_idv_piid', 'Parent IDV PIID'], ['award_key', 'USAspending award key'],
    ['recipient_name', 'Recipient'], ['recipient_uei', 'Recipient UEI'], ['parent_name', 'Parent company'], ['parent_uei', 'Parent UEI'],
    ['company_page', 'Company page'],
    ['agency', 'Awarding agency'], ['agency_code', 'Agency code'], ['sub_agency', 'Sub-agency'],
    ['date_signed', 'Date signed'], ['fiscal_year', 'Fiscal year signed'],
    ['obligated_to_date_usd', 'Obligated to date (USD)'],
    ['extent_competed', 'Extent competed (as coded)'], ['extent_competed_code', 'Extent competed code'],
    ['far_justification', 'Reason not fully competed (FAR)'], ['solicitation_procedures', 'Solicitation procedures'],
    ['naics_code', 'NAICS'], ['psc_code', 'PSC'], ['description', 'Description'],
    ['loaded_through', 'Last seen in USAspending load'], ['award_page_url', 'USAspending award page'],
  ].map(([key, label]) => ({ key, label }));
  const rows = result.rows.map((a) => {
    const parentKey = a.recipient_parent_uei || a.recipient_uei;
    const parentName = (a.recipient_parent_uei ? a.recipient_parent_name : null) || a.recipient_name;
    return {
      piid: a.award_id,
      parent_idv_piid: a.parent_award_piid,
      award_key: a.generated_unique_award_id ?? a.id,
      recipient_name: a.recipient_name,
      recipient_uei: a.recipient_uei,
      parent_name: a.recipient_parent_name,
      parent_uei: a.recipient_parent_uei,
      company_page: parentKey && parentName ? `https://slushfund.net/companies/${companySlug(parentKey, parentName)}` : null,
      agency: a.awarding_agency,
      agency_code: a.awarding_agency_code,
      sub_agency: a.awarding_sub_agency,
      date_signed: a.date_signed ?? a.posted_date,
      fiscal_year: a.fiscal_year,
      obligated_to_date_usd: a.obligated_amount,
      extent_competed: a.extent_competed,
      extent_competed_code: a.extent_competed_code,
      far_justification: a.other_than_full_open,
      solicitation_procedures: a.solicitation_procedures,
      naics_code: a.naics_code,
      psc_code: a.psc_code,
      description: a.description,
      loaded_through: a.last_seen_at ? a.last_seen_at.slice(0, 10) : null,
      award_page_url: a.usaspending_url,
    };
  });
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('slushfund-non-competed-contracts')}"`,
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      'X-Rows-Matched': String(result.total),
      'X-Rows-Exported': String(rows.length),
      'X-Row-Cap': String(EXPORT_ROW_CAP),
    },
  });
}
