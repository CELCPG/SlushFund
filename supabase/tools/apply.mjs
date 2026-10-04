import fs from 'node:fs';
import { connectAny } from './db.mjs';
const file = process.argv[2];
const sql = fs.readFileSync(file, 'utf8');
const c = await connectAny();
console.log('connected via', c._via);
const t0 = Date.now();
try {
  await c.query(sql);
  console.log('APPLIED OK in', Date.now() - t0, 'ms');
} catch (e) {
  console.log('FAILED:', e.code, e.message, e.position ? '(pos ' + e.position + ')' : '', e.where || '');
  try { await c.query('rollback'); } catch {}
  process.exitCode = 1;
}
await c.end();
