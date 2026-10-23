import 'server-only';
import { createHash } from 'node:crypto';
import { CHRONOLOGY_CSV_B64 } from '@/lib/v2/iran-war-chronology-file';

/**
 * The frozen chronology (pre-registration "Chronology freeze"), byte for byte, and its sha256 computed from those bytes. The page prints
 * this hash and the download serves these bytes, so they cannot disagree. FROZEN_SHA256 is the hash of the re-freeze under pre-registration
 * amendment A4 (2026-10-23, after the independent audit: 401 rows; the first freeze, 399 rows, 08:55 ET, hashed to 81f6f9c0...); a file that
 * does not hash to it is not served and the page says "Figures unavailable".
 */
export const FROZEN_SHA256 = '323ef4531cf8cac0bae91a750a58916690df8a6f4b9f139a7d006abfac29a818';

export function chronologyFile(): { bytes: Buffer; sha256: string; ok: boolean } {
  const bytes = Buffer.from(CHRONOLOGY_CSV_B64, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { bytes, sha256, ok: sha256 === FROZEN_SHA256 };
}
