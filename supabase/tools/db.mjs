// Shared helper: connect to the new slushfund Supabase project. Never prints secrets.
import fs from 'node:fs';
import pg from 'pg';
const env = {};
for (const l of fs.readFileSync('C:/Users/clong/.openclaw/.env','utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
export const REF = 'fgqrprfzdompbhakggqg';
export const env_ = env;
const pw = env.SLUSHFUND_DB_PASSWORD;
export const targets = {
  direct: { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  pooler_session: { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  pooler_txn: { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, user: `postgres.${REF}` },
  pooler1_session: { host: 'aws-1-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
};
export async function connect(which) {
  const t = targets[which];
  const c = new pg.Client({ ...t, password: pw, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  return c;
}
export async function connectAny() {
  const errs = [];
  for (const k of ['direct','pooler_session','pooler1_session']) {
    try { const c = await connect(k); c._via = k; return c; } catch (e) { errs.push(`${k}: ${e.code||''} ${e.message}`); }
  }
  throw new Error('no connection: ' + errs.join(' | '));
}
