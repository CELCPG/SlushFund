#!/usr/bin/env node
/**
 * sync-cli.ts — RETIRED (R5, 2026-10-03).
 * It ran lib/sync.ts (no amount filter, one upsert per award on the non-unique PIID).
 * Awards load with src/scripts/load_awards.py under rule r5-v1:
 *   python src/scripts/load_awards.py load --fy 2026
 *   python src/scripts/load_awards.py incremental --days 7
 */
console.error('sync-cli.ts is retired: use `python src/scripts/load_awards.py` (see its docstring).');
process.exit(1);
