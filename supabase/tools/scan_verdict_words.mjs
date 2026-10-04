// R6e: verdict-word scan over everything the anon role can read or execute.
//   BINDING list (must be 0 outside verbatim source text): the A7b report's list (fraud, suspicious, flagged, risk, inflated,
//   overpay, no_bid, severe, conflicted) + R6d's (violation, corrupt, illegal, insider).
//   WIDE list (informational): the A7b scan script's own regex, which also matches 'sole_source' (an FPDS term), abuse, scheme...
// Checks names (tables, views, columns, functions, arguments), function bodies, stored values (every text / json column) and
// the output keys / values of every anon-executable RPC, called as anon through PostgREST.
// Hits inside columns that carry a government's or a filer's own words (USAspending award text, agency / office names, SEC
// registrant names) are reported as source_text, not as ours.
// Run from a folder that has node_modules/pg:   node scan_verdict_words.mjs [out.json]      exit 1 = a binding hit of ours remains
import fs from 'node:fs';
import { connectAny, env_ } from './db.mjs';

const BIND = 'fraud|suspicious|inflated|overpa|no.?bid|severe|conflicted|flagged|(^|[^a-z])risk|violat|corrupt|illegal|insider';
const WIDE = BIND + '|suspect|unlawful|crime|criminal|scandal|kickback|brib|crony|self.?deal|pay.?to.?play|scheme|steal|stole|theft|abuse|slush|' +
  'overcharg|sole.?source|guilt|unethic|shady|rigged|conflict.of.interest|red.?flag|dark.?money';
const rxB = new RegExp(BIND, 'i'), rxW = new RegExp(WIDE, 'i');
const SOURCE_TEXT = new Set(['awards.description', 'awards.set_aside', 'awards.solicitation_procedures', 'awards.naics_description',
  'awards.psc_description', 'awards.awarding_agency', 'awards.awarding_sub_agency', 'awards.awarding_office', 'awards.awarding_office_name',
  'awards.funding_agency', 'awards.funding_sub_agency', 'awards.recipient_name', 'awards.recipient_parent_name', 'awards.notes',
  'awards.fair_opportunity_limited', 'awards.other_than_full_open', 'awards.recipient_location', 'awards.pop_city',
  'awards.primary_place_of_performance', 'contract_spending_summary.agency_name', 'agency_spending_summary.awarding_agency',
  'top_vendors.recipient_name', 'company_tickers.sec_name', 'company_tickers.recipient_name', 'company_tickers.recipient_parent_name',
  'company_tickers.notes', 'congress_trades.company_name', 'award_tickers.recipient_name', 'award_tickers.recipient_parent_name',
  'award_tickers.sec_name', 'most_traded_stocks.company_name', 'sector_trades.company_name']);

const outFile = process.argv[2] || 'scan.json';
const c = await connectAny();
const q = async (s, p) => (await c.query(s, p)).rows;
const hits = [];
const add = (where, kind, what, n, ex, binding) => hits.push({ where, kind, what, n, binding, ex: ex == null ? null : String(ex).slice(0, 120),
  source_text: kind === 'VALUE' && SOURCE_TEXT.has(`${where}.${what}`) });
const tag = s => (rxB.test(s) ? true : (rxW.test(s) ? false : null));

const rels = await q(`select c.oid, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','v','m','p') and has_table_privilege('anon', c.oid, 'select') order by 1`);
const fns = await q(`select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args, pg_get_functiondef(p.oid) def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
  and has_function_privilege('anon', p.oid, 'execute') order by 2`);
const stats = { relations: rels.length, functions: fns.length, columns: 0, value_columns: 0 };

for (const r of rels) {
  const nm = tag(r.relname);
  if (nm !== null) add(r.relname, 'NAME', r.relname, 1, r.relname, nm);
  const cols = await q(`select a.attname, format_type(a.atttypid, a.atttypmod) typ from pg_attribute a
    where a.attrelid=$1 and a.attnum>0 and not a.attisdropped order by a.attnum`, [r.oid]);
  stats.columns += cols.length;
  for (const col of cols) {
    const t = tag(col.attname);
    if (t !== null) add(r.relname, 'COLUMN', col.attname, 1, col.attname, t);
    if (!/text|char|json|\[\]|name|uuid/i.test(col.typ)) continue;
    stats.value_columns++;
    const [w] = await q(`select count(*)::int n, min(x) ex from (select "${col.attname}"::text x from public."${r.relname}") t where x ~* $1`, [WIDE]);
    if (w.n > 0) {
      const [b] = await q(`select count(*)::int n, min(x) ex from (select "${col.attname}"::text x from public."${r.relname}") t where x ~* $1`, [BIND]);
      if (b.n > 0) add(r.relname, 'VALUE', col.attname, b.n, b.ex, true);
      if (w.n > b.n) add(r.relname, 'VALUE', col.attname, w.n - b.n, w.ex, false);
    }
    if (/json/i.test(col.typ)) {
      const keys = await q(`select distinct k from public."${r.relname}", lateral (select jsonb_object_keys(case when jsonb_typeof("${col.attname}"::jsonb)='object' then "${col.attname}"::jsonb else '{}'::jsonb end) k) s limit 500`);
      for (const k of keys) {
        const kt = tag(k.k);
        if (kt !== null) add(r.relname, 'JSON_KEY', `${col.attname}.${k.k}`, 1, k.k, kt);
      }
    }
  }
}
for (const f of fns) {
  const nt = tag(f.proname);
  if (nt !== null) add(f.proname, 'FUNCTION_NAME', f.proname, 1, f.proname, nt);
  const at = tag(f.args);
  if (at !== null) add(f.proname, 'FUNCTION_ARGS', f.args, 1, f.args, at);
  const body = f.def.replace(/^[\s\S]*?\bAS\b\s+\$[a-z_]*\$/i, '');
  const mw = body.match(new RegExp(WIDE, 'ig'));
  if (mw) {
    const mb = body.match(new RegExp(BIND, 'ig'));
    if (mb) add(f.proname, 'FUNCTION_BODY', [...new Set(mb.map(s => s.toLowerCase()))].join(','), mb.length, null, true);
    if (mw.length > (mb ? mb.length : 0)) add(f.proname, 'FUNCTION_BODY', [...new Set(mw.map(s => s.toLowerCase()))].join(','), mw.length - (mb ? mb.length : 0), null, false);
  }
}
const url = env_.SLUSHFUND_SUPABASE_URL, key = env_.SLUSHFUND_SUPABASE_ANON_KEY;
const argsFor = { get_era_stats: { start_date: '2021-01-01', end_date: '2026-12-31' }, get_senator_report_card: { p_slug: 'x' },
  get_trade_related_contracts: { trades_json: [] } };
const rpcStatus = {};
function walk(o, path, where) {
  if (Array.isArray(o)) { o.slice(0, 300).forEach(v => walk(v, path + '[]', where)); return; }
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      const t = tag(k);
      if (t !== null) add(where, 'RPC_KEY', `${path}.${k}`, 1, k, t);
      walk(v, path + '.' + k, where);
    }
    return;
  }
  if (typeof o === 'string') {
    const t = tag(o);
    if (t !== null) add(where, 'RPC_VALUE', path, 1, o, t);
  }
}
for (const f of fns) {
  const res = await fetch(`${url}/rest/v1/rpc/${f.proname}`, { method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(argsFor[f.proname] || {}) });
  rpcStatus[f.proname] = res.status;
  if (res.ok) walk(await res.json(), '', 'rpc:' + f.proname);
}
await c.end();
const bind = hits.filter(h => h.binding && !h.source_text), src = hits.filter(h => h.binding && h.source_text), wide = hits.filter(h => !h.binding);
fs.writeFileSync(outFile, JSON.stringify({ binding_words: BIND, wide_words: WIDE, stats, rpcStatus, binding_ours: bind, binding_source_text: src, wide_only: wide }, null, 1));
console.log(JSON.stringify(stats), 'rpc:', JSON.stringify(rpcStatus));
console.log(`BINDING hits ours=${bind.length}  source_text=${src.length}  | wide-only (informational)=${wide.length}`);
for (const h of bind.slice(0, 60)) console.log(`  ${h.kind.padEnd(13)} ${h.where}.${h.what}  n=${h.n}  ${h.ex ?? ''}`);
for (const h of src.slice(0, 15)) console.log(`  [source] ${h.where}.${h.what}  n=${h.n}  ${h.ex}`);
for (const h of wide.slice(0, 15)) console.log(`  [wide]   ${h.kind} ${h.where}.${h.what}  n=${h.n}  ${h.ex ?? ''}`);
process.exitCode = bind.length ? 1 : 0;
