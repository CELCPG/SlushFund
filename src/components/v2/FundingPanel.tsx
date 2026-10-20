import { Card, SectionHead } from '@/components/v2/PageBand';
import type { CampaignMoneyResult } from '@/lib/v2/campaign-money';
import { fmtDate, fmtUsd } from '@/lib/v2/format';

/**
 * D10 "Who funds them" (G1 §3, not graded). FEC 2026 cycle from F1's member_campaign_money. Until the view exists
 * (migration pending Apex) or while the flag is off, it says only "Campaign finance data: coming soon".
 * Shares use total receipts as the denominator and do not add to 100 (loans, transfers and other receipts are in no
 * group). PAC shares come from the giving committees' reports (FEC pas2), and the panel says so.
 */
const PARTS: { key: 'pct_small_individual' | 'pct_large_individual' | 'pct_corporate_trade_pac' | 'pct_labor_pac' | 'pct_leadership_party_other' | 'pct_self_funded'; label: string; color: string }[] = [
  { key: 'pct_small_individual', label: 'Small donors (unitemized)', color: '#C2410C' },
  { key: 'pct_large_individual', label: 'Larger individual gifts (itemized)', color: '#E07B3F' },
  { key: 'pct_corporate_trade_pac', label: 'Corporate and trade-association PACs', color: '#1D1A4E' },
  { key: 'pct_labor_pac', label: 'Labor PACs', color: '#0B7A84' },
  { key: 'pct_leadership_party_other', label: 'Leadership, party and other committees', color: '#6534D9' },
  { key: 'pct_self_funded', label: 'Self-funding', color: '#4F5170' },
];

export default function FundingPanel({ money, enabled, name }: { money: CampaignMoneyResult; enabled: boolean; name: string }) {
  const comingSoon = !enabled || money.state === 'missing';
  return (
    <section className="pt-8" aria-labelledby="p-funds" data-section="who-funds-them">
      <Card>
        <SectionHead as="h2" title={<span id="p-funds" className="text-[24px] max-md:text-[22px]">Who funds them</span>} />
        {comingSoon ? (
          <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">Campaign finance data: coming soon</p>
        ) : money.state === 'error' ? (
          <p className="rounded-2xl bg-stale-tint px-4 py-3 text-[14.5px] text-stale-ink">Campaign finance data is unavailable right now: the database did not answer.</p>
        ) : money.state === 'none' ? (
          <p className="rounded-2xl bg-neutral-tint px-4 py-3 text-[14.5px] text-muted">No FEC candidate record confirmed for {name} yet, so no campaign figures are shown.</p>
        ) : (
          <Funding row={money.row} name={name} />
        )}
      </Card>
    </section>
  );
}

function Funding({ row, name }: { row: Extract<CampaignMoneyResult, { state: 'ok' }>['row']; name: string }) {
  const through = fmtDate(row.coverage_end) ?? 'the latest report';
  const parts = PARTS.map((p) => ({ ...p, pct: row[p.key] == null ? null : Number(row[p.key]) }));
  const corp = row.pct_corporate_trade_pac == null ? null : Number(row.pct_corporate_trade_pac);
  return (
    <>
      <p className="text-[15.5px]">
        {name}&rsquo;s 2026 campaign reported {fmtUsd(row.raised) ?? 'no'} in total receipts (FEC, through {through}).
        {corp != null && <> {corp.toFixed(1)}% of {name}&rsquo;s 2026 campaign receipts came from corporate and trade-association PACs (FEC, through {through}).</>}
      </p>
      <div className="mt-4 flex h-7 w-full overflow-hidden rounded-lg bg-neutral-tint" role="img" aria-label={`Shares of total receipts: ${parts.map((p) => `${p.label} ${p.pct == null ? 'not available' : `${p.pct.toFixed(1)}%`}`).join('; ')}.`}>
        {parts.map((p) => (p.pct && p.pct > 0 ? <span key={p.key} style={{ width: `${Math.min(100, p.pct)}%`, background: p.color }} /> : null))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13.5px] max-md:grid-cols-1">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span>{p.label}: <b className="font-mono">{p.pct == null ? 'not available' : `${p.pct.toFixed(1)}%`}</b></span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[14.5px]">
        Outside spending (independent expenditures, FEC Schedule E): {fmtUsd(row.outside_support) ?? '$0'} for {name}, {fmtUsd(row.outside_oppose) ?? '$0'} against.
      </p>
      <p className="mt-3 text-[12.5px] text-muted">
        Source: Federal Election Commission bulk data, 2025–26 cycle, through {through}. Shares are of total receipts and do not add to 100: loans, transfers and other receipts are in no group. PAC shares come from the giving committees&rsquo; own reports.
        Taking legal PAC money is not misconduct; this panel is not graded.{' '}
        {row.fec_candidate_url && <a href={row.fec_candidate_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-trades-ink underline">FEC record ↗</a>}
      </p>
    </>
  );
}
