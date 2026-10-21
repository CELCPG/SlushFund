import { Card, SectionHead } from '@/components/v2/PageBand';
import type { CampaignMoneyResult } from '@/lib/v2/campaign-money';
import { fmtDate, fmtUsd } from '@/lib/v2/format';

/**
 * D10 "Who funds them" (G1 A3, not graded). FEC 2025-26 cycle from F1's member_campaign_money; wording per A12 M5-M8
 * (f1b-funding-fix.md): one template for every member, plain FEC figures, no candidate framing.
 * Shares use the committee's total receipts as the denominator and do not add to 100 (loans, transfers and other
 * receipts are in no group). PAC shares come from the giving committees' reports (FEC pas2) matched to the receiving
 * committee whose receipts are the denominator. When a share is negative or the shares add to more than 100 (refunds or
 * giver-side reports that do not line up with the committee's own receipts) no share sentence or bar is printed.
 */
export const PARTS: { key: 'pct_small_individual' | 'pct_large_individual' | 'pct_corporate_trade_pac' | 'pct_labor_pac' | 'pct_leadership_party_other' | 'pct_self_funded'; label: string; color: string }[] = [
  { key: 'pct_small_individual', label: 'Small donors (unitemized)', color: '#C2410C' },
  { key: 'pct_large_individual', label: 'Larger individual gifts (itemized)', color: '#E07B3F' },
  { key: 'pct_corporate_trade_pac', label: 'Corporate and trade-association PACs', color: '#1D1A4E' },
  { key: 'pct_labor_pac', label: 'Labor PACs', color: '#0B7A84' },
  { key: 'pct_leadership_party_other', label: 'Leadership, party and other committees', color: '#6534D9' },
  { key: 'pct_self_funded', label: 'Self-funding', color: '#4F5170' },
];

export const CYCLE = '2025\u201326 FEC cycle';
// D21: the graphic reuses these sentences, so there is one wording for each state.
export const FUNDING_COMING_SOON = 'Campaign finance data: coming soon';
export const FUNDING_UNAVAILABLE = 'Campaign finance data is unavailable right now: the database did not answer.';
export const fundingNoRecord = (name: string) => `No FEC candidate record confirmed for ${name} yet, so no campaign figures are shown.`;
export const FUNDING_NO_RECEIPTS = `No receipts reported for the ${CYCLE} (FEC).`;
export const SHARES_NOT_SHOWN = 'Shares not shown: in this period, refunds or giver-side reports do not line up with the campaign\u2019s own total receipts. See the FEC record.';

export default function FundingPanel({ money, enabled, name }: { money: CampaignMoneyResult; enabled: boolean; name: string }) {
  const comingSoon = !enabled || money.state === 'missing';
  return (
    <section className="pt-8" aria-labelledby="p-funds" data-section="who-funds-them">
      <Card>
        <SectionHead as="h2" title={<span id="p-funds" className="text-[24px] max-md:text-[22px]">Who funds them</span>} />
        {comingSoon ? (
          <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">{FUNDING_COMING_SOON}</p>
        ) : money.state === 'error' ? (
          <p className="rounded-2xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink">{FUNDING_UNAVAILABLE}</p>
        ) : money.state === 'none' ? (
          <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">{fundingNoRecord(name)}</p>
        ) : (
          <Funding row={money.row} name={name} />
        )}
      </Card>
    </section>
  );
}

function pctText(p: number | null): string {
  return p == null ? '0.0%' : `${p.toFixed(1)}%`;
}

function Funding({ row, name }: { row: Extract<CampaignMoneyResult, { state: 'ok' }>['row']; name: string }) {
  const through = fmtDate(row.coverage_end) ?? 'the latest report';
  const raised = row.raised == null ? 0 : Number(row.raised);
  const fecLink = row.fec_candidate_url ? (
    <a href={row.fec_candidate_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink underline">FEC record &#8599;</a>
  ) : null;

  // M8: zero or empty receipts.
  if (!(raised > 0)) {
    return (
      <>
        <p className="text-[15.5px]">{FUNDING_NO_RECEIPTS}</p>
        <p className="mt-3 text-[12.5px] text-muted">Source: Federal Election Commission bulk data. This panel carries no grade. {fecLink}</p>
      </>
    );
  }

  const parts = PARTS.map((p) => ({ ...p, pct: row[p.key] == null ? 0 : Number(row[p.key]) }));
  const corp = row.pct_corporate_trade_pac == null ? 0 : Number(row.pct_corporate_trade_pac);
  const showShares = row.shares_ok === true;
  const alt = row.alt_fec_cand_id && row.alt_office_label ? row : null;
  const altRaised = alt && alt.alt_raised != null ? Number(alt.alt_raised) : null;
  const altThrough = alt ? fmtDate(alt.alt_coverage_end) ?? 'the latest report' : null;
  return (
    <>
      <p className="text-[15.5px]">
        {name}&rsquo;s campaign committee reported {fmtUsd(raised)} in total receipts in the {CYCLE} (through {through}).
        {showShares && <> {pctText(corp)} of those receipts came from corporate and trade-association PACs, by the PACs&rsquo; own reports (FEC, through {through}).</>}
      </p>
      {row.office_label && (
        <p className="mt-1 text-[13.5px] text-muted" data-field="fec-record-office">
          These figures are for the FEC candidate record for {row.office_label}.
          {alt && alt.alt_same_committee && <> {name} also has an FEC record for {alt.alt_office_label}; it uses the same committee, whose receipts are in these figures.</>}
          {alt && !alt.alt_same_committee && altRaised != null && (
            <> {name} also has an FEC record for {alt.alt_office_label}: that committee reported {fmtUsd(altRaised)} in total receipts in the same cycle (through {altThrough}).{' '}
              {alt.alt_fec_candidate_url && <a href={alt.alt_fec_candidate_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink underline">FEC record &#8599;</a>}</>
          )}
        </p>
      )}
      {showShares ? (
        <>
          <div className="mt-4 flex h-7 w-full overflow-hidden rounded-lg bg-neutral-tint" role="img" aria-label={`Shares of total receipts: ${parts.map((p) => `${p.label} ${pctText(p.pct)}`).join('; ')}.`}>
            {parts.map((p) => (p.pct > 0 ? <span key={p.key} style={{ width: `${Math.min(100, p.pct)}%`, background: p.color }} /> : null))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13.5px] max-md:grid-cols-1">
            {parts.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span>{p.label}: <b className="font-mono">{pctText(p.pct)}</b></span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted" data-field="shares-not-shown">
          {SHARES_NOT_SHOWN}
        </p>
      )}
      <p className="mt-4 text-[14.5px]">
        Outside spending (independent expenditures, FEC Schedule E): {fmtUsd(row.outside_support) ?? '$0'} for {name}, {fmtUsd(row.outside_oppose) ?? '$0'} against.
      </p>
      <p className="mt-3 text-[12.5px] text-muted">
        Source: Federal Election Commission bulk data, {CYCLE}, through {through}. {showShares && <>Shares are of total receipts and do not add to 100: loans, transfers and other receipts are in no group. PAC shares come from the giving committees&rsquo; own reports. </>}
        Taking legal PAC money is not misconduct; this panel carries no grade.{' '}
        {fecLink}
      </p>
    </>
  );
}