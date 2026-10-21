// D19 independent recompute of the /analytics figures, for the Auditor (not shown on the site).
//
//   node scripts/analytics-recompute.mjs [http://localhost:3330]
//
// Reads the database with the anon key from .env.local (read only), with its own paging and counting code (no import
// from src/lib/v2/analytics.ts), prints each figure and, when a base URL is given, compares it with the rendered page.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function count(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return Number((r.headers.get('content-range') ?? '').split('/')[1]);
}
async function all(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) return out;
  }
}
const nf = (n) => Number(n).toLocaleString('en-US');
const figs = [];
const fig = (name, value, query) => { figs.push({ name, value, query }); };

// 1. coverage
fig('house_trades', await count('congress_trades?select=id&source_system=eq.House_Clerk'), "count congress_trades where source_system='House_Clerk'");
fig('senate_trades', await count('congress_trades?select=id&source_system=eq.Senate_EFD'), "count congress_trades where source_system='Senate_EFD'");
fig('exec', await count('executive_trades?select=id'), 'count executive_trades');
fig('fec', await count('member_campaign_money?select=bioguide_id'), 'count member_campaign_money');
fig('subject', await count('subject_award_transactions?select=transaction_key'), 'count subject_award_transactions');
fig('contracts', await count('awards?select=id'), 'count awards');
fig('members', await count('congress_members?select=id&in_office=eq.true'), 'count congress_members where in_office');
const officials = new Set((await all('executive_trades?select=official_id&order=id')).map((r) => r.official_id)).size;
fig('executive officials', officials, 'count distinct executive_trades.official_id');

// 2. first-filed reports per month, last 24 calendar months, by chamber
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const [ty, tm] = today.split('-').map(Number);
const start = new Date(Date.UTC(ty, tm - 1 - 23, 1)).toISOString().slice(0, 10);
const reports = await all(`congress_trades?select=source_system,original_source_doc_id,original_filed_date&original_source_doc_id=not.is.null&original_filed_date=gte.${start}&order=id`);
const seen = new Map();
for (const r of reports) seen.set(`${r.source_system}|${r.original_source_doc_id}`, r.source_system);
fig('reports House (24 months)', [...seen.values()].filter((s) => s === 'House_Clerk').length, `count distinct original_source_doc_id, source_system=House_Clerk, original_filed_date >= ${start}`);
fig('reports Senate (24 months)', [...seen.values()].filter((s) => s === 'Senate_EFD').length, `count distinct original_source_doc_id, source_system=Senate_EFD, original_filed_date >= ${start}`);

// 3. days from trade to first report (lateness computed)
const days = await all("congress_trades?select=days_to_file&lateness_basis=eq.computed&days_to_file=not.is.null&order=id");
const edges = [[0, 7], [8, 14], [15, 30], [31, 45], [46, 60], [61, 90], [91, 180], [181, Infinity]];
const bins = edges.map(([a, b]) => days.filter((d) => d.days_to_file >= a && d.days_to_file <= b).length);
edges.forEach(([a, b], i) => fig(`days ${a}-${b === Infinity ? 'plus' : b}`, bins[i], `count congress_trades where lateness_basis='computed' and days_to_file between ${a} and ${b === Infinity ? 'inf' : b}`));
fig('days binned total', days.length, "count congress_trades where lateness_basis='computed' and days_to_file is not null (negatives included in no bin: " + days.filter((d) => d.days_to_file < 0).length + ')');
fig('over 45', days.filter((d) => d.days_to_file > 45).length, 'count days_to_file > 45 among the above');

// 4. campaign receipts
const money = await all('member_campaign_money?select=raised,coverage_end&order=bioguide_id');
fig('raised total', Math.round(money.reduce((n, r) => n + (r.raised == null ? 0 : Number(r.raised)), 0)), 'sum member_campaign_money.raised (nulls skipped)');
fig('raised missing', money.filter((r) => r.raised == null).length, 'count member_campaign_money where raised is null');
const q = (d) => `${d.slice(0, 4)} Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const byQ = {};
for (const r of money) if (r.raised != null && r.coverage_end) { byQ[q(r.coverage_end)] = (byQ[q(r.coverage_end)] ?? 0) + 1; }
for (const [k, v] of Object.entries(byQ).sort()) fig(`members, latest report in ${k}`, v, `count member_campaign_money by quarter(coverage_end) = ${k}`);

// 6. unread (static file) and sync_log failures need the service key / the JSON file; see the report for those.

console.log('| figure | value | query |\n|---|---|---|');
for (const f of figs) console.log(`| ${f.name} | ${nf(f.value)} | ${f.query} |`);

const base = process.argv[2];
if (base) {
  const html = (await (await fetch(`${base}/analytics`)).text()).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  let bad = 0;
  const check = (label, ok) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); };
  for (const k of ['house_trades', 'senate_trades', 'exec', 'fec', 'subject', 'contracts', 'members']) {
    const m = new RegExp(`data-figure="${k === 'exec' ? 'exec' : k}">([0-9,]+)<`).exec(html);
    check(`coverage ${k}: page ${m?.[1]} = db ${nf(figs.find((f) => f.name === k).value)}`, m && m[1] === nf(figs.find((f) => f.name === k).value));
  }
  const vt = /data-figure="volume-totals">[\s\S]*?<b>([0-9,]+)<\/b>[\s\S]*?<b>([0-9,]+)<\/b>/.exec(html);
  check(`reports 24 months: page ${vt?.[1]} / ${vt?.[2]}`, vt && vt[1] === nf(figs.find((f) => f.name === 'reports House (24 months)').value) && vt[2] === nf(figs.find((f) => f.name === 'reports Senate (24 months)').value));
  edges.forEach(([a, b], i) => check(`bin ${a}-${b === Infinity ? 'plus' : b}: ${nf(bins[i])} in page table`, text.includes(`${nf(bins[i])}`)));
  check(`over 45: ${nf(figs.find((f) => f.name === 'over 45').value)} of ${nf(days.length)}`, text.includes(`${nf(figs.find((f) => f.name === 'over 45').value)} of ${nf(days.length)}`));
  check(`raised total: ${nf(figs.find((f) => f.name === 'raised total').value)}`, text.includes(`$${nf(figs.find((f) => f.name === 'raised total').value)}`));
  console.log(bad ? `${bad} FAILED` : 'all match');
  process.exitCode = bad ? 1 : 0;
}
