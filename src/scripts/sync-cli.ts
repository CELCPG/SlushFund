#!/usr/bin/env node
/**
 * sync-cli.ts — Run contract sync from the command line
 * Usage: npx ts-node src/scripts/sync-cli.ts [--full]
 */
// @ts-nocheck

import { fullBackfill, syncContracts } from '../lib/sync';

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');

  console.log(full ? '🚀 Starting full backfill...' : '🔄 Starting incremental sync...');

  const start = Date.now();

  if (full) {
    const result = await fullBackfill();
    console.log(`\n✅ Backfill complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    console.log(`   Synced: ${result.synced} contracts`);
    console.log(`   Flagged: ${result.flagged} awards`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
    }
  } else {
    const end = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await syncContracts(startDate, end);
    console.log(`\n✅ Sync complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    console.log(`   Synced: ${result.synced} contracts`);
    console.log(`   Flagged: ${result.flagged} awards`);
  }
}

main().catch(console.error);