// D10 grade distribution check, for the Auditor (not shown on the site): counts per Stock Trading Grade by party and
// chamber for every sitting member, computed with the same code the pages use (src/lib/v2/grade-method.ts).
//
//   node scripts/grade-distribution.mjs [out.md]
//
// Reads congress_trades and congress_members with the anon key from .env.local (read only).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { activityOf, gradeClass, gradeOf, inWindow, windowStart } from '../src/lib/v2/grade-method.ts';
import { instrumentKind } from '../src/lib/v2/instruments.ts';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function all(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path.split('?')[0]} -> ${r.status}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) return out;
  }
}

const end = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const start = windowStart(end);
const COLS = 'id,bio_guide_id,ticker,company_name,asset_type,option_type,transaction_type,transaction_date,amount_min,date_flag,stock_act_late,committee_conflict,has_federal_contract,disclosure_url,original_disclosure_url,original_source_doc_id,source_doc_id';
const [trades, roster] = await Promise.all([
  all(`congress_trades?select=${COLS}&transaction_date=gte.${start}&transaction_date=lte.${end}&order=id`),
  all('congress_members?select=bioguide_id,name,party,chamber,state,in_office&in_office=eq.true&bioguide_id=not.is.null&order=bioguide_id'),
]);
const by = new Map();
let flaggedOut = 0;
for (const r of trades) {
  if (!inWindow(r, start, end)) { flaggedOut++; continue; }
  if (!r.bio_guide_id) continue;
  const list = by.get(r.bio_guide_id) ?? [];
  list.push({ ...r, cls: gradeClass(r, instrumentKind(r)) });
  by.set(r.bio_guide_id, list);
}
const LETTERS = ['A', 'B', 'C', 'D', 'F'];
const groups = new Map();
const results = [];
for (const m of roster) {
  const list = by.get(m.bioguide_id) ?? [];
  const a = activityOf(m.bioguide_id, list);
  const g = gradeOf(list, a);
  results.push({ m, a, g });
  for (const key of [`${m.party} · ${m.chamber}`, `${m.party} · both`, `all · ${m.chamber}`, 'all · both']) {
    const t = groups.get(key) ?? Object.fromEntries([...LETTERS.map((l) => [l, 0]), ['n', 0], ['notComputed', 0]]);
    t[g.letter]++; t.n++;
    if (g.factors.some((f) => !f.computed)) t.notComputed++;
    groups.set(key, t);
  }
}
const lines = [];
lines.push(`Window ${start} to ${end} (trade dates). Rows read ${trades.length}; with a date note, not scored: ${flaggedOut}. Sitting members ${roster.length}.`);
lines.push('');
lines.push('| party · chamber | members | A | B | C | D | F | with a factor not computed |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const [k, t] of [...groups.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
  lines.push(`| ${k} | ${t.n} | ${LETTERS.map((l) => `${t[l]} (${t.n ? ((100 * t[l]) / t.n).toFixed(0) : 0}%)`).join(' | ')} | ${t.notComputed} |`);
}
const scores = results.map((r) => r.g.score).sort((a, b) => a - b);
lines.push('');
lines.push(`Score quartiles (all sitting members): min ${scores[0]}, q1 ${scores[Math.floor(scores.length / 4)]}, median ${scores[Math.floor(scores.length / 2)]}, q3 ${scores[Math.floor((3 * scores.length) / 4)]}, max ${scores[scores.length - 1]}.`);
const factorTotals = {};
for (const r of results) for (const f of r.g.factors) { factorTotals[f.key] ??= { pts: 0, members: 0, notComputed: 0 }; factorTotals[f.key].pts += f.points; if (f.points) factorTotals[f.key].members++; if (!f.computed) factorTotals[f.key].notComputed++; }
lines.push('');
lines.push('| factor | members scoring >0 | points awarded | members "not computed" |');
lines.push('|---|---|---|---|');
for (const [k, v] of Object.entries(factorTotals)) lines.push(`| ${k} | ${v.members} | ${v.pts} | ${v.notComputed} |`);
const out = lines.join('\n');
console.log(out);
if (process.argv[2]) writeFileSync(process.argv[2], out + '\n');
