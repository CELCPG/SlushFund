// Builds src/data/unread-filings.json: per member, the filings we hold but could not read
// (scanned House PTRs from R3, paper Senate PTRs from R4). The person page prints these so a
// member with scanned filings never looks like a member with no trades.
//
//   node scripts/build-unread-filings.mjs <r3 scanned-filings-not-loaded.csv> <r4 paper-filings.csv>
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
const roster = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/congress_members?select=bioguide_id,name,last_name,state,district,chamber&limit=1000`, { headers: H })).json();

function csv(path) {
  const [head, ...lines] = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map((raw) => {
    const l = raw.replace(/""[^"]*""\s*/g, ''); // drop quoted nicknames ("Chuck")
    const f = [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1]).slice(0, cols.length);
    return Object.fromEntries(cols.map((c, i) => [c, f[i]]));
  });
}
const ascii = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const out = {};
const misses = [];
// Reisdorf and Henriquez in the R3 list were candidates who filed, not members: they stay unmatched.
for (const r of csv(process.argv[2])) {
  const st = r.state_dist.slice(0, 2), dist = String(Number(r.state_dist.slice(2)));
  const last = ascii(r.member.split(' ').filter((t) => !/^(jr|sr|ii|iii|iv)\.?,?$/i.test(t)).pop().replace(/,$/, ''));
  const house = roster.filter((m) => m.state === st && ascii(m.name).includes(last));
  const cands = house.filter((m) => m.chamber === 'House').length ? house.filter((m) => m.chamber === 'House') : house;
  const pick = cands.length === 1 ? cands[0] : cands.find((m) => String(Number(m.district)) === dist);
  if (!pick) { misses.push(`${r.member} ${r.state_dist}`); continue; }
  const o = (out[pick.bioguide_id] ??= { house_scanned: 0, senate_paper: 0 });
  o.house_scanned += 1;
}
for (const r of csv(process.argv[3])) {
  const o = (out[r.bioguide_id] ??= { house_scanned: 0, senate_paper: 0 });
  o.senate_paper += 1;
}
writeFileSync(new URL('../src/data/unread-filings.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`members ${Object.keys(out).length} · unmatched ${misses.length}${misses.length ? ': ' + [...new Set(misses)].join('; ') : ''}`);
