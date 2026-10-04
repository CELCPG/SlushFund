/**
 * What a disclosed transaction is, and how to say it (A7 audit S1, H1, H2; R6a columns).
 * Plain functions with no server imports: TradesTable (client) and the pages both use them.
 *
 *  - Options are never shown as a plain buy or sell of the stock. With option_type set we say
 *    "Bought put options"; until R6a fills it, an option row is listed apart, with the asset as filed.
 *  - Bonds, funds, crypto and "other" assets are not company stock either: listed apart, as filed.
 *  - Owner "Self" also covers trusts and accounts filed with a blank owner (H1).
 *  - A row with date_flag set keeps its dates as filed; it never drives sorting or "latest".
 */

export interface InstrumentFields {
  ticker?: string | null;
  company_name?: string | null;
  asset_type?: string | null;
  transaction_type: string;
  option_type?: string | null;
  strike?: number | string | null;
  expiry?: string | null;
  owner?: string | null;
  date_flag?: string | null;
}

export type InstrumentKind = 'stock' | 'option' | 'other';

const OPTION_ASSET = /option/i;
// eFD sometimes files a call or put under "Stock" with a name like "TFC CALL". Word-bounded, so
// "Option Care Health" or "Callaway" are not caught.
const OPTION_NAME = /\b(calls?|puts?)\b/i;
const OTHER_ASSET = /^(bond|other|crypto|fund|etf|mutual fund|corporate bond|municipal security)$/i;

export function instrumentKind(t: InstrumentFields): InstrumentKind {
  if (t.option_type) return 'option';
  const a = (t.asset_type ?? '').trim();
  if (OPTION_ASSET.test(a)) return 'option';
  // "Covered Call ETF" and similar fund names are shares of a fund, not a call option.
  if (OPTION_NAME.test(t.company_name ?? '') && !/option care|\b(etf|fund|trust)\b/i.test(t.company_name ?? '')) return 'option';
  if (a && OTHER_ASSET.test(a)) return 'other';
  if (a && !/^stock$/i.test(a)) return 'other';
  return 'stock';
}

/**
 * Options and non-stock assets are listed apart from stock purchases and sales and never count as
 * one. With option_type set (R6a) they read "Bought put options on CVX"; until then, as filed.
 */
export function isListedApart(t: InstrumentFields): boolean {
  return instrumentKind(t) !== 'stock';
}

const VERB: Record<string, [string, string]> = {
  BUY: ['Bought', 'Purchase'],
  SELL: ['Sold', 'Sale'],
  SELL_PARTIAL: ['Sold part of', 'Partial sale'],
  EXCHANGE: ['Exchanged', 'Exchange'],
  EXERCISE: ['Exercised', 'Exercise'],
};

/** Short type label for a table cell: "Purchase", "Sale", "Bought put options", "Option purchase". */
export function typeLabel(t: InstrumentFields): string {
  const [verb, noun] = VERB[t.transaction_type] ?? [t.transaction_type, t.transaction_type];
  const k = instrumentKind(t);
  if (k === 'option') {
    if (t.option_type === 'call' || t.option_type === 'put') return `${verb} ${t.option_type} options`;
    if (t.option_type === 'unknown') return `${verb} options (call or put not stated)`;
    return `Option ${noun.toLowerCase()}`;
  }
  if (k === 'other') return `${noun} (${(t.asset_type || 'other asset').toLowerCase()})`;
  return noun;
}

/** One sentence: "Bought put options on CVX", "Sold MSFT stock". */
export function tradeSentence(t: InstrumentFields): string {
  const [verb] = VERB[t.transaction_type] ?? [t.transaction_type];
  const what = t.ticker || t.company_name || 'an asset';
  const k = instrumentKind(t);
  if (k === 'option') {
    if (t.option_type === 'call' || t.option_type === 'put') return `${verb} ${t.option_type} options on ${what}`;
    return `${verb} options on ${what} (details in the filing)`;
  }
  if (k === 'other') return `${verb} ${t.company_name || what} (${(t.asset_type || 'other asset').toLowerCase()}, as filed)`;
  return `${verb} ${what} stock`;
}

/** "strike $145 · expires Sep 20, 2024" when R6a has them, else null. */
export function optionDetail(t: InstrumentFields): string | null {
  const parts: string[] = [];
  const strike = t.strike == null ? null : Number(t.strike);
  if (strike != null && Number.isFinite(strike)) parts.push(`strike $${strike.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
  if (t.expiry) {
    const d = new Date(`${t.expiry.slice(0, 10)}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) parts.push(`expires ${d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** H1: "Self" covers trusts and accounts filed with a blank owner. Lists ("Self, Spouse") stay lists. */
export function ownerLabel(owner: string | null | undefined): string | null {
  if (!owner) return null;
  return owner
    .split(/\s*,\s*/)
    .map((o) => (/^self$/i.test(o) ? 'Self (incl. trusts/accounts)' : o))
    .join(', ');
}

// Reader wording for date_flag lives in date-flags.ts (one map, one file).

export function hasDateFlag(t: InstrumentFields): boolean {
  return !!t.date_flag;
}
