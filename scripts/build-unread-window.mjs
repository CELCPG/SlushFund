// Builds src/data/unread-window.json: per member, the FILING DATES of scanned House PTRs and paper Senate PTRs we hold
// but could not read, 2024-10-20 onward (A12 M2). The grade counts only the ones filed inside its 24-month window, so a
// member whose A rests on zero read filings shows "Not graded" instead of a letter.
//
//   node scripts/build-unread-window.mjs <unread_window.json>
//
// Input = the Auditor's A12 list (unread2.py): { bioguide: [[ "H"|"S", doc id or url, "YYYY-MM-DD" filing date ], ...] }, built from
// R3's scanned-filings-not-loaded.csv + the 6 House filings R9 found newly scanned + the 44 Senate paper filings (R4/R9).
// Output keeps dates only (sorted); src/data/unread-filings.json (2021-2026 totals for the member note) is unchanged.
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = {};
let reports = 0;
for (const [bio, list] of Object.entries(src)) {
  const dates = list.map((x) => x[2]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) continue;
  out[bio] = dates;
  reports += dates.length;
}
writeFileSync(new URL('../src/data/unread-window.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`members ${Object.keys(out).length} · unread reports filed since 2024-10-20: ${reports}`);
