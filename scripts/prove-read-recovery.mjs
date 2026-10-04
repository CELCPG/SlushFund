// A8 L4 proof (D8d): a failed database read is not kept, neither by the loaders' memo nor by ISR.
//
// 1. Build while reads are failing:   SLUSHFUND_TEST_FAIL_READS_UNTIL=<ms well in the future> npm run build
//    (every prerendered page says "unavailable"; the route table shows Revalidate 1m on the ISR pages that read data)
// 2. Start the server with the failure window ending soon:
//    SLUSHFUND_TEST_FAIL_READS_UNTIL=<now + ~75 s, epoch ms> next start -p <port>
// 3. node scripts/prove-read-recovery.mjs http://localhost:<port> <same epoch ms>
//
// While the window is open every page shows its "unavailable" state. After it closes:
//   - dynamic pages (search, companies) recover on the very next request (the memo dropped the failed read);
//   - ISR pages were cached for 60 s (s-maxage=60), not their route's 10 or 30 minutes, and come back good on the
//     regeneration after that (s-maxage=600 or 1800).
// Exit 0 when all of that holds. The hook is ignored on the production deployment (src/lib/v2/flags.ts).

const [base, untilArg] = process.argv.slice(2);
const until = Number(untilArg);
if (!base || !Number.isFinite(until)) {
  console.error('usage: node scripts/prove-read-recovery.mjs <baseUrl> <untilEpochMs>');
  process.exit(2);
}
const DYNAMIC = ['/search?q=Lockheed', '/companies'];
const ISR = ['/', '/about/methodology/contracts', '/agencies'];
const FAILED = /unavailable right now|Data temporarily unavailable/i;
const t0 = Date.now();
const stamp = () => `${new Date().toISOString().slice(11, 19)} (+${Math.round((Date.now() - until) / 1000)}s vs window end)`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const check = (cond, what) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`);
  if (!cond) ok = false;
};

async function get(path) {
  const r = await fetch(base + path);
  const body = await r.text();
  const res = { path, status: r.status, failed: FAILED.test(body), cache: r.headers.get('x-nextjs-cache') ?? '-', cc: r.headers.get('cache-control') ?? '-' };
  console.log(`${stamp()} ${path} ${res.status} ${res.failed ? 'UNAVAILABLE' : 'good'} x-nextjs-cache=${res.cache} cache-control=${res.cc}`);
  return res;
}
const sMaxAge = (cc) => Number(/s-maxage=(\d+)/.exec(cc)?.[1] ?? NaN);

console.log(`window ends ${new Date(until).toISOString()} (${Math.round((until - t0) / 1000)} s from now)`);
console.log('\n## Phase 1: reads failing');
for (const p of [...DYNAMIC, ...ISR]) {
  const r = await get(p);
  check(r.status === 200 && r.failed, `${p} shows its unavailable state (never a zero)`);
  if (ISR.includes(p)) check(sMaxAge(r.cc) === 60, `${p} failed render cached for 60 s, not the route's revalidate (${r.cc})`);
}
if (Date.now() >= until) {
  console.log('the window closed before phase 1 finished; start the server with a later end time');
  process.exit(2);
}
await sleep(until - Date.now() + 1000);

console.log('\n## Phase 2: reads answering again');
for (const p of DYNAMIC) {
  const r = await get(p);
  check(r.status === 200 && !r.failed, `${p} recovers on the first request after the failure (no memoized null)`);
}
const recovered = new Map();
for (let i = 0; i < 20 && recovered.size < ISR.length; i++) {
  for (const p of ISR) {
    if (recovered.has(p)) continue;
    const r = await get(p);
    if (!r.failed && r.cache === 'HIT') recovered.set(p, { r, after: Math.round((Date.now() - until) / 1000) });
  }
  if (recovered.size < ISR.length) await sleep(10_000);
}
for (const p of ISR) {
  const hit = recovered.get(p);
  check(Boolean(hit), `${p} serves the good page from cache ${hit ? `${hit.after} s after the window closed` : 'within 200 s'}`);
  if (hit) check(sMaxAge(hit.r.cc) >= 600, `${p} good render keeps the route's revalidate (${hit.r.cc})`);
}
console.log(`\n${ok ? 'L4 PROVEN' : 'L4 NOT PROVEN'}`);
process.exit(ok ? 0 : 1);
