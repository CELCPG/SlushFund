// W2: issuer-key parity. The story joins each President transaction line to its issuer group by a key; the key function is a TypeScript
// port of src/scripts/w1a_norm.py and w1a_issuers.py (SlushFund-w1). This test runs the port over EVERY distinct asset string that the
// Python run keyed (scripts/fixtures/iran-war-issuer-keys.json, made from D:\slushfund-data\w1\issuers\issuer_keys.json) and fails
// the build on one difference. `npm run build` runs it first (the "prebuild" script).
//
//   node scripts/iran-war-parity.mjs            full run, exit 1 on any mismatch
//
// Skipped (exit 0, says so) only on the production deployment while SHOW_IRAN_WAR_STORY is not 1, where the story is not built.
import { readFileSync } from 'node:fs';
import { execIssuerKey } from '../src/lib/v2/iran-war-core.ts';

if (process.env.VERCEL_ENV === 'production' && process.env.SHOW_IRAN_WAR_STORY !== '1') {
  console.log('iran-war parity: skipped (production build with SHOW_IRAN_WAR_STORY off)');
  process.exit(0);
}

const fx = JSON.parse(readFileSync(new URL('./fixtures/iran-war-issuer-keys.json', import.meta.url), 'utf8'));
let checked = 0;
const bad = [];
for (const g of fx.groups) {
  for (const [i, asset] of g.a.entries()) {
    checked += 1;
    const got = execIssuerKey(g.c, asset);
    // The Python entry keeps the bond kind of the first line that made the key; later lines with the same key can read differently
    // (the kind never changes the key), so the kind is compared on the first asset only.
    const kindOk = g.c !== 'bond' || i > 0 || got.kind === g.b;
    if (got.key !== g.k || !kindOk) bad.push({ class: g.c, asset, want: g.k, wantKind: g.b, got: got.key, gotKind: got.kind });
  }
}
const pct = checked ? (100 * (checked - bad.length)) / checked : 0;
console.log(`iran-war parity: ${checked - bad.length}/${checked} asset strings give the Python issuer key (${pct.toFixed(2)}%), ${fx.entries} keys, source sha256 ${fx.sha256.slice(0, 12)}`);
if (checked !== fx.assets || bad.length > 0) {
  for (const b of bad.slice(0, 8)) console.log(`  MISMATCH [${b.class}] ${JSON.stringify(b.asset)} want ${JSON.stringify(b.want)}/${b.wantKind} got ${JSON.stringify(b.got)}/${b.gotKind}`);
  console.log(checked !== fx.assets ? `  fixture says ${fx.assets} strings, ${checked} checked` : `  ${bad.length} mismatches`);
  process.exit(1);
}
