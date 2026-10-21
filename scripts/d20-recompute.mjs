// D20 recompute, for the Auditor: re-derives every headline figure on the four /graphics pages straight from the database with its own
// paging and counting code (no import from src/lib/v2/graphics-data.ts), then checks that each figure appears on the rendered page.
//
//   node scripts/d20-recompute.mjs [baseUrl] [out.md]
//
// Reads with the anon key from .env.local (read only). The grade counts come from scripts/grade-distribution.mjs, which calls the same
// grade-method.ts the pages use (the method itself is audited separately, A12); everything else is recomputed here from raw columns.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const base = process.argv[2] ?? 'http://localhost:3335';
const env = Object.fromEntries(readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function all(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let r;
    for (let t = 0; t < 3; t++) {
      r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
      if (r.ok) break;
      await new Promise((d) => setTimeout(d, 500));
    }
    if (!r.ok) throw new Error(`${path.split('?')[0]} -> ${r.status}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) return out;
  }
}
const n = (v) => Number(v ?? 0);
const fmt = (x) => Math.round(x).toLocaleString('en-US');
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const text = async (slug) => (await (await fetch(`${base}/graphics/${slug}`)).text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const lines = [];
let bad = 0;
function check(label, expected, pageText) {
  const ok = pageText.includes(expected);
  if (!ok) bad++;
  lines.push(`| ${label} | ${expected} | ${ok ? 'match' : 'NOT ON PAGE'} |`);
}

// ---- 1. grades
{
  const t = await text('grading-congress');
  const out = execFileSync(process.execPath, [join(ROOT, 'scripts/grade-distribution.mjs')], { encoding: 'utf8', cwd: ROOT });
  const m = /\| all .{1,6} both \| (\d+) \| (\d+) \(\d+%\) \| (\d+) \(\d+%\) \| (\d+) \(\d+%\) \| (\d+) \(\d+%\) \| (\d+) \(\d+%\) \| (\d+) \(\d+%\)/.exec(out);
  if (!m) throw new Error('could not read the grade-distribution table');
  const [total, A, NG, B, C, D, F] = m.slice(1).map(Number);
  lines.push('## Graphic 1: grades (scripts/grade-distribution.mjs, all sitting members)');
  lines.push('| figure | expected | on page |', '|---|---|---|');
  check('sitting members', `${fmt(total)} sitting members of Congress`, t);
  check('A, B, C, D, F, not graded (caption sentence)', `${fmt(A)} A, ${fmt(B)} B, ${fmt(C)} C, ${fmt(D)} D, ${fmt(F)} F and ${fmt(NG)} not graded`, t);
  const roster = await all('congress_members?select=bioguide_id&in_office=eq.true&bioguide_id=not.is.null&order=bioguide_id');
  lines.push(`| in-office roster rows (independent count) | ${roster.length} | ${roster.length === total ? 'equals the member total' : 'DIFFERS'} |`);
  if (roster.length !== total) bad++;
}

// ---- 2. receipts
{
  const t = await text('where-the-money-comes-from');
  const rows = await all('member_campaign_money?select=*&order=bioguide_id');
  const ok = rows.filter((r) => r.shares_ok === true && n(r.raised) > 0);
  const S = (f) => ok.reduce((s, r) => s + f(r), 0);
  const total = S((r) => n(r.raised));
  const g = {
    'Small donors (unitemized)': S((r) => n(r.individual_unitemized)),
    'Larger individual gifts (itemized)': S((r) => n(r.individual_itemized)),
    'Corporate and trade-association PACs': S((r) => n(r.pac_corporate_trade)),
    'Labor PACs': S((r) => n(r.pac_labor)),
    'Leadership, party and other committees': S((r) => ['pac_leadership', 'pac_party_committee', 'pac_candidate_committee', 'pac_cooperative', 'pac_membership_org', 'pac_nonconnected', 'pac_other'].reduce((a, k) => a + n(r[k]), 0)),
    'Self-funding': S((r) => n(r.candidate_contrib)),
  };
  g['Loans, transfers and other receipts'] = total - Object.values(g).reduce((a, b) => a + b, 0);
  lines.push('', '## Graphic 2: receipts (member_campaign_money, shares_ok = true and raised > 0)');
  lines.push('| figure | expected | on page |', '|---|---|---|');
  check('members counted', `${fmt(ok.length)} members of Congress`, t);
  check('members with an FEC row / left out', `${rows.length - ok.length} of ${rows.length} members`, t);
  check('total receipts', `$${fmt(total)}`, t);
  for (const [k, v] of Object.entries(g)) check(k, `${k} $${fmt(v)} ${pct(v / total)}`, t);
  const last = rows.map((r) => r.coverage_end).filter(Boolean).sort().pop();
  lines.push(`| latest coverage_end | ${last} | (printed as a date; see page) |`);
  // The six printed groups tie to the page's own per-member shares: each group's dollars / raised equals the stored pct (rounded to 0.1) for every member.
  let tie = 0;
  for (const r of rows.filter((x) => n(x.raised) > 0)) {
    const lead = ['pac_leadership', 'pac_party_committee', 'pac_candidate_committee', 'pac_cooperative', 'pac_membership_org', 'pac_nonconnected', 'pac_other'].reduce((a, k) => a + n(r[k]), 0);
    const pairs = [[n(r.individual_unitemized), r.pct_small_individual], [n(r.individual_itemized), r.pct_large_individual], [n(r.pac_corporate_trade), r.pct_corporate_trade_pac], [n(r.pac_labor), r.pct_labor_pac], [lead, r.pct_leadership_party_other], [n(r.candidate_contrib), r.pct_self_funded]];
    if (pairs.some(([d, p]) => Math.abs((100 * d) / n(r.raised) - n(p)) > 0.06)) tie++;
  }
  lines.push(`| members whose dollars-per-group do not reproduce the stored member-page shares (should be 0) | ${tie} | ${tie === 0 ? 'ok' : 'DIFFERS'} |`);
  if (tie) bad++;
}

// ---- 3. days to report
{
  const t = await text('trading-while-disclosing');
  const rows = await all('congress_trades?select=days_to_file,stock_act_late&lateness_basis=eq.computed&days_to_file=not.is.null&order=id');
  const edges = [[0, 7], [8, 14], [15, 30], [31, 45], [46, 60], [61, 90], [91, 180], [181, Infinity]];
  const bins = edges.map(([lo, hi]) => rows.filter((r) => n(r.days_to_file) >= lo && n(r.days_to_file) <= hi).length);
  const over = rows.filter((r) => n(r.days_to_file) > 45).length;
  const lateFlag = rows.filter((r) => r.stock_act_late === true).length;
  lines.push('', '## Graphic 3: days to report (congress_trades, lateness_basis = computed, days_to_file set)');
  lines.push('| figure | expected | on page |', '|---|---|---|');
  check('transactions plotted', `of ${fmt(rows.length)} transactions`, t);
  check('share over 45 days', `${fmt(over)} of ${fmt(rows.length)} transactions (${pct(over / rows.length)}) were reported more than 45 days after the trade`, t);
  ['0–7', '8–14', '15–30', '31–45', '46–60', '61–90', '91–180', '181+'].forEach((label, i) => check(`bin ${label}`, `${label} ${fmt(bins[i])} ${pct(bins[i] / rows.length)}`, t));
  lines.push(`| rows with stock_act_late = true (site's own flag) vs days_to_file > 45 | ${fmt(lateFlag)} vs ${fmt(over)} | ${lateFlag === over ? 'identical' : 'DIFFERS'} |`);
  if (lateFlag !== over) bad++;
  const allRows = (await fetch(`${URL_}/rest/v1/congress_trades?select=id&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' } })).headers.get('content-range');
  const totalAll = Number(allRows.split('/')[1]);
  check('rows with no computed gap (not plotted)', `${fmt(totalAll - rows.length)} of ${fmt(totalAll)} transactions have no computed gap`, t);
}

// ---- 4. the President
{
  const t = await text('the-presidents-trades');
  const tr = await all('executive_trades?select=source_doc_id,instrument_class&office=eq.President&report_type=eq.278-T&order=id');
  const docs = new Set(tr.map((r) => r.source_doc_id));
  const cls = (k) => tr.filter((r) => r.instrument_class === k).length;
  const fil = await all('executive_filings?select=source_doc_id,filer_signed_date,amendment_signed_date,reviewer_comment,reviewer_comment_kind,transaction_count&order=source_doc_id');
  const mine = fil.filter((f) => docs.has(f.source_doc_id));
  const notes = mine.filter((f) => f.reviewer_comment_kind === 'late_fee_note' && f.reviewer_comment);
  const signed = mine.map((f) => f.filer_signed_date).filter(Boolean).sort();
  lines.push('', '## Graphic 4: the President (executive_trades office = President, report_type = 278-T; executive_filings)');
  lines.push('| figure | expected | on page |', '|---|---|---|');
  check('reports and transactions', `${fmt(tr.length)} securities transactions in ${docs.size} periodic transaction reports`, t);
  check('stocks / bonds / funds', `Stocks ${fmt(cls('stock'))}, Bonds ${fmt(cls('bond'))}, Funds ${fmt(cls('fund'))}`, t);
  check('reports with the reviewing official’s late-fee note', `On ${notes.length} of the ${docs.size} reports, the reviewing official wrote in the comments box`, t);
  for (const f of notes) check('verbatim comment', `“${f.reviewer_comment}”`, t);
  lines.push(`| earliest / latest filer_signed_date (executive_filings) | ${signed[0]} / ${signed[signed.length - 1]} | page uses the report's first-signed date from the trade rows; compare by eye |`);
  lines.push(`| per-report transaction_count (executive_filings) sums to the trade rows | ${fmt(mine.reduce((s, f) => s + n(f.transaction_count), 0))} vs ${fmt(tr.length)} | ${mine.reduce((s, f) => s + n(f.transaction_count), 0) === tr.length ? 'identical' : 'differs (an amended file counts its restated lines once)'} |`);
  lines.push(`| (brief says 10,103: the 10 Vance rows are office <> President and are in no President figure) | ${fmt(tr.length)} | |`);
}

const out = ['# D20 recompute', '', `Page base: ${base}. Run ${new Date().toISOString()}. ${bad ? bad + ' MISMATCH(ES)' : 'All figures reproduced.'}`, '', ...lines].join('\n');
console.log(out);
if (process.argv[3]) writeFileSync(process.argv[3], out + '\n');
process.exit(bad ? 1 : 0);
