/**
 * W2: the figures behind "The President's securities transactions during the Iran war" (/investigations/president-iran-war), as pure
 * functions: no database, no server-only and no runtime imports, so scripts/verify-gates.mjs and scripts/iran-war-parity.mjs run them on
 * their own DB dump. Windows, groups and measures are exactly as pre-registered (w1-iran-war-preregistration.md sections 2, 3 and 5, and
 * amendments A1 and A2). Nothing is typed in: the loaders in iran-war.ts return null on a failed read and the page says "Figures
 * unavailable". No return, gain, loss or profit is computed for any transaction (M6, G3).
 */

// ---------------------------------------------------------------- inputs (the columns the story reads)

export interface ExecRow {
  id: string;
  asset: string;
  instrument_class: string | null;
  transaction_type: string;
  transaction_date: string;
  amount_min: number | null;
  amount_max: number | null;
  amount_range: string | null;
  days_to_file: number | null;
  stock_act_late: boolean | null;
  source_doc_id: string;
  disclosure_url: string;
  page_number: number | null;
  row_number_printed: number | null;
  line_on_page: number | null;
}
export const EXEC_COLS = 'id,asset,instrument_class,transaction_type,transaction_date,amount_min,amount_max,amount_range,days_to_file,stock_act_late,source_doc_id,disclosure_url,page_number,row_number_printed,line_on_page';

export interface FilingRow {
  source_doc_id: string;
  file_name: string;
  disclosure_url: string;
  oge_posted_date: string | null;
  filer_signed_date: string | null;
  daeo_signed_date: string | null;
  reviewer_comment: string | null;
  reviewer_comment_kind: string | null;
  reviewer_comment_ref_page: number | null;
  reviewer_comment_ref_line: number | null;
  cover_page: number | null;
}
export const FILING_COLS = 'source_doc_id,file_name,disclosure_url,oge_posted_date,filer_signed_date,daeo_signed_date,reviewer_comment,reviewer_comment_kind,reviewer_comment_ref_page,reviewer_comment_ref_line,cover_page';

export interface CongressRow {
  id: string;
  member_id: string;
  member_name: string;
  member_chamber: string;
  member_party: string | null;
  member_state: string | null;
  bio_guide_id: string | null;
  ticker: string | null;
  company_name: string | null;
  transaction_type: string;
  asset_type: string | null;
  /** The stored instrument column: 'option' marks option lines (the page counts stock purchases, not options). */
  instrument: string | null;
  amount_min: number | null;
  amount_max: number | null;
  transaction_date: string;
  stock_act_late: boolean | null;
  days_to_file: number | null;
  disclosure_url: string | null;
}
export const CONGRESS_COLS = 'id,member_id,member_name,member_chamber,member_party,member_state,bio_guide_id,ticker,company_name,transaction_type,asset_type,instrument,amount_min,amount_max,transaction_date,stock_act_late,days_to_file,disclosure_url';

export interface ChronRow {
  id: string;
  event_date: string;
  event_time_et: string | null;
  lane: string;
  actor: string | null;
  event_text: string;
  quote: string | null;
  source_url: string;
  archive_url: string | null;
  source_kind: string | null;
  labelled_marker: boolean;
  marker_basis: string | null;
}
export const CHRON_COLS = 'id,event_date,event_time_et,lane,actor,event_text,quote,source_url,archive_url,source_kind,labelled_marker,marker_basis';

export interface EiaRow {
  series: string;
  price_date: string;
  usd_per_bbl: number | null;
}
export const EIA_COLS = 'series,price_date,usd_per_bbl';

export interface IssuerRow {
  issuer_key: string;
  source_table: string;
  instrument: string;
  ticker: string | null;
  cik: string | null;
  sec_name: string | null;
  sic: string | null;
  sic_major: string | null;
  group_e: string | null;
  group_d_sic: string | null;
  group_d_dod: string | null;
  decided_by: string | null;
  note: string | null;
}
export const ISSUER_COLS = 'issuer_key,source_table,instrument,ticker,cik,sec_name,sic,sic_major,group_e,group_d_sic,group_d_dod,decided_by,note';

export interface IranWarInputs {
  exec: ExecRow[];
  filings: FilingRow[];
  congress: CongressRow[];
  chron: ChronRow[];
  eia: EiaRow[];
  issuers: IssuerRow[];
}

// ---------------------------------------------------------------- windows (pre-registration section 2, trade date as printed)

export type WindowKey = 'P0' | 'P1' | 'P2' | 'P3';
export interface WindowDef { key: WindowKey; label: string; from: string; to: string }
export const WINDOWS: readonly WindowDef[] = [
  { key: 'P0', label: 'Context: Jan 21 to Dec 31, 2025', from: '2025-01-21', to: '2025-12-31' },
  { key: 'P1', label: 'The two months before the strikes: Jan 2 to Feb 27, 2026', from: '2026-01-02', to: '2026-02-27' },
  { key: 'P2', label: 'The war’s first month: Feb 28 to Mar 31, 2026', from: '2026-02-28', to: '2026-03-31' },
  { key: 'P3', label: 'Months two to five: Apr 1 to Jul 31, 2026', from: '2026-04-01', to: '2026-07-31' },
];
export const WAR_START = '2026-02-28';
export const AXIS_START = '2025-12-01';
export const AXIS_END = '2026-07-31';
/** The last trade date in the loaded reports (pre-registration section 2: later trades are "not yet in our data"). */
export const DATA_THROUGH = '2026-07-31';
export const ALPHA = 0.05;

export function windowOf(date: string): WindowKey | null {
  for (const w of WINDOWS) if (date >= w.from && date <= w.to) return w.key;
  return null;
}
export const windowDef = (k: WindowKey): WindowDef => WINDOWS.find((w) => w.key === k)!;

// ---------------------------------------------------------------- dates and numbers

const DAY_MS = 86_400_000;
export function dayNumber(d: string): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd) / DAY_MS;
}
export function addDays(d: string, n: number): string {
  return new Date((dayNumber(d) + n) * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}
/** "Aug 12, 2025" (same output as format.ts fmtDate; kept here so this file has no runtime imports). */
export function fmtDate(d: string | null | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
}
/** "Tuesday, March 24, 2026". */
export function fmtLongDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
export function fmtMonth(m: string): string {
  return new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', year: 'numeric' });
}
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
export const usd = (n: number): string => `$${fmtInt(n)}`;
/** "between $1,001 and $15,000": a band range, never a single total (G3). */
export const usdRange = (min: number, max: number): string => `between ${usd(min)} and ${usd(max)}`;
export function pct(part: number, whole: number, places = 0): string {
  if (!whole) return 'n/a';
  return (Math.round((100 * part) / whole * 10 ** places) / 10 ** places).toFixed(places);
}
/** A p-value the way the page prints it. */
export function fmtP(p: number): string {
  if (p < 0.001) return 'less than 0.001';
  return p.toFixed(3);
}

// ---------------------------------------------------------------- issuer key (port of src/scripts/w1a_norm.py and w1a_issuers.py)

const LEGAL_CANON: Record<string, string> = {
  INCORPORATED: 'INC', CORPORATION: 'CORP', COMPANY: 'CO', LIMITED: 'LTD', HOLDING: 'HOLDINGS', HLDGS: 'HOLDINGS', HLDG: 'HOLDINGS',
  HIDGS: 'HOLDINGS', PANY: 'CO', COMPAN: 'CO', COR: 'CORP', CRP: 'CORP', GROU: 'GROUP',
};
const LEGAL_TAIL = new Set(['INC', 'CORP', 'CO', 'LLC', 'LP', 'LLLP', 'LLP', 'LTD', 'PLC', 'NV', 'SA', 'AG', 'SE', 'PC', 'PLLC', 'HOLDINGS', 'NEW', 'DEL', 'DE']);
const ABBR: Record<string, string> = {
  INTERNTL: 'INTERNATIONAL', INTERNTNL: 'INTERNATIONAL', CONS: 'CONSOLIDATED', GENL: 'GENERAL', COS: 'COMPANIES', WKS: 'WORKS', CMNTYS: 'COMMUNITIES',
  FDG: 'FUNDING', BKG: 'BANKING', INTL: 'INTERNATIONAL', MGMT: 'MANAGEMENT', UTILS: 'UTILITIES', NAT: 'NATURAL', GEN: 'GENERAL', FINL: 'FINANCIAL',
  TECHS: 'TECHNOLOGIES', TECH: 'TECHNOLOGY', PHARMS: 'PHARMACEUTICALS', COMMUNICATIONS: 'COMMUNICATIONS', COMMUN: 'COMMUNICATIONS',
  ENTMT: 'ENTERTAINMENT', ENTERPRISES: 'ENTERPRISES', SVCS: 'SERVICES', SYS: 'SYSTEMS', AMER: 'AMERICAN', NATL: 'NATIONAL',
  MKTS: 'MARKETS', RES: 'RESOURCES', PPTYS: 'PROPERTIES', BANCORP: 'BANCORP', LABS: 'LABORATORIES', INDS: 'INDUSTRIES',
  IND: 'INDUSTRIES', PRODS: 'PRODUCTS', PROD: 'PRODUCTS', MFG: 'MANUFACTURING', CHEM: 'CHEMICAL', ELEC: 'ELECTRIC',
  ENERGY: 'ENERGY', GRP: 'GROUP', ASSOC: 'ASSOCIATES', SOLNS: 'SOLUTIONS',
  SOLN: 'SOLUTION', NETWKS: 'NETWORKS', SEMICONDUCTOR: 'SEMICONDUCTOR', TELECOMM: 'TELECOMMUNICATIONS',
};
const NOISE_CUT = /\b(WITH DUE BILLS|TENDER OFFER|MERGER ELECTION|AVG|CHG|USD\d*|FORMERLY|32 EACH|UNSOLICITIED|UNSOLICITED|SOLICITED ORDER|AVERAGE UNIT PRICE|DISCRETIONARY ORDER|YOUR BROKER|FORWARD SPLIT|IF THIS CONFIR|ISLN#|ISIN|CUSIP|REG S\b|144A)\b/;
const CLASS_TAIL = /\b(CLASS|CL)\s+(CLASS\s+|CL\s+|SERIES\s+|SER\s+)?[A-Z0-9]\b|\bSERIES [A-Z]\b|\bCAP STK\b|\bPAR \d+\b|\bPAIRED\b|\bCTF \d\b|\bINC DELAWARE\b|\bCOM\b|\bCOMMON( STOCK| SHARES)?\b|\bORD(INARY)?\b|\bSHS\b|\bSHARES\b|\bSTOCK\b|\bUNITS?\b|\bADS\b|\bADR\b|\bSPONSORED\b|\bREIT\b|\bEQUITY\b|\bNEW\b|\bCORN\b/g;
const TRUNC_TAILS = new Set(['I', 'IN', 'INC', 'C', 'CO', 'COR', 'CORP', 'COM', 'COMP', 'COMPA', 'COMPAN', 'COMPANY', 'PANY', 'CORPO', 'CORPOR', 'CORPORA', 'CORPORAT', 'CORPORATI', 'CORPORATIO',
  'H', 'HL', 'HLD', 'HOLD', 'HOLDING', 'L', 'LT', 'LTD', 'PIC', 'PLC', 'P', 'PL', 'F', 'N', 'V', 'NV', 'SA', 'AG', 'IND', 'THE', 'NEW', 'DELA', 'DEL', 'OHIO', 'WASH', 'LA', 'EQU']);
const TRUNC_ALWAYS = new Set(['F', 'THE', 'NEW', 'PIC', 'EQU']);

const TREASURY_RE = /\b(U\s?S\s+TREAS\w*|UNITED STATES TREAS\w*|TREASURY (NOTE|BOND|BILL)\w*|US GOVT|T[- ]BILL)\b/;
const MUNI_STRONG = /(\bB\/E\b|\bREV\b|\bRFDG\b|\bPSF\b|\bGTD\b|\bSCH D\w*\b|\bCNTY\b|\bCOUNTY\b|\bAUTH\b|\bTRANSN\b|\bINDPT\b|\bMUN PURP\b|\bUNLTD TAX\b|\bLTD TAX\b|\bGO BDS\b|\bISD\b)/;
const MUNI_WEAK = /\b(CITY|ST|STATE|HOSP|UNIV|COLL|WTR|WATER|SEWER|IMPT|HSG|FACS?|DEV|FIN|PORT|TWP|VLG|TOWN|PARISH|DIST|CONS|LN|FD|MUN|PWR|AGY|HLTH|HEALTH|PUB|UTIL|TPK|EXPWY|COMM|MLTIFAM|MULTI|SCHS?|SCHOOL|BLDG|BLDGS|PPTY|HO|HOUSING)\b/g;
const US_STATES = /\b(ALABAMA|ALASKA|ARIZONA|ARKANSAS|CALIFORNIA|COLORADO|CONNECTICUT|DELAWARE|FLORIDA|GEORGIA|HAWAII|IDAHO|ILLINOIS|INDIANA|IOWA|KANSAS|KENTUCKY|LOUISIANA|MAINE|MARYLAND|MASSACHUSETTS|MICHIGAN|MINNESOTA|MISSISSIPPI|MISSOURI|MONTANA|NEBRASKA|NEVADA|NEW HAMPSHIRE|NEW JERSEY|NEW MEXICO|NEW YORK|NORTH CAROLINA|NORTH DAKOTA|OHIO|OKLAHOMA|OREGON|PENNSYLVANIA|RHODE IS(LAND)?|SOUTH CAROLINA|SOUTH DAKOTA|TENNESSEE|TEXAS|UTAH|VERMONT|VIRGINIA|WASHINGTON|WEST VIRGINIA|WISCONSIN|WYOMING|PUERTO RICO|GUAM)\b/;
const CORP_WORD = /\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|LLC|LP|BANK|BANCORP|FINANCIAL|HOLDINGS|GROUP|N\s?A|NA|TRUST|CAPITAL|CREDIT)\b/;
const BOND_CUT = /(\d+(\.\d+)?\s*%|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\bDUE\b|\bDUO\b|\bB\/E\b|\bDTD\b|\bSER(IES)?\b|\bRFDG\b|\bNTS?\b|\bBDS?\b|\bSR\b|\bREG S\b|\b(19|20)\d\d\b|\*{3})/;
const FUND_CUT = /\b(SOLICITED|UNSOLICITED|DISCRETION\w*|YOUR BROKER|J\.?P\.? MORGAN)\b/i;

/** NFKD, then drop everything outside ASCII, then upper-case (Python: unicodedata.normalize + encode("ascii", "ignore") + upper). */
export function asciiUp(s: string | null | undefined): string {
  return (s ?? '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toUpperCase();
}
function pyStrip(s: string): string {
  return s.replace(/^[\s\x1c-\x1f]+|[\s\x1c-\x1f]+$/g, '');
}
function pySplit(s: string): string[] {
  return s.split(/[\s\x1c-\x1f]+/).filter((w) => w.length > 0);
}
function rawTokens(name: string): string[] {
  let s = pyStrip(asciiUp(name));
  s = s.replace(/&/g, ' AND ');
  s = s.replace(/[.'`]/g, '');
  s = s.replace(/[^A-Z0-9#]+/g, ' ');
  let t = pySplit(s).filter((w) => w !== 'AND');
  if (t.length > 1 && t[0] === 'THE') t = t.slice(1);
  return t;
}
function cleanStockText(name: string): string {
  let s = asciiUp(name);
  s = s.split(NOISE_CUT)[0];
  s = s.replace(/\(THE\)/g, ' ');
  s = s.replace(CLASS_TAIL, ' ');
  return s;
}
function baseTokens(name: string): string[] {
  return rawTokens(name).map((w) => ABBR[w] ?? w).map((w) => LEGAL_CANON[w] ?? w);
}
export function looseTokens(name: string): string[] {
  const t = baseTokens(name);
  while (t.length > 1 && LEGAL_TAIL.has(t[t.length - 1])) t.pop();
  return t;
}
/** w1a_norm.issuer_stock_key. */
export function issuerStockKey(asset: string): string {
  const trunc = [...asset].length >= 22;
  const t = baseTokens(cleanStockText(asset));
  if (t.length > 2 && t[t.length - 1].length === 1 && /^[A-Z]$/.test(t[t.length - 1]) && LEGAL_TAIL.has(t[t.length - 2])) t.pop();
  while (t.length > 1 && TRUNC_TAILS.has(t[t.length - 1]) && (trunc || TRUNC_ALWAYS.has(t[t.length - 1]))) t.pop();
  while (t.length > 1 && LEGAL_TAIL.has(t[t.length - 1])) t.pop();
  return t.join(' ');
}
export type BondKind = 'treasury' | 'municipal' | 'corporate' | 'undetermined';
/** w1a_issuers.bond_kind: (kind, issuer key). */
export function bondKind(asset: string): { kind: BondKind; key: string } {
  const s = asciiUp(asset);
  if (TREASURY_RE.test(s)) return { kind: 'treasury', key: 'US TREASURY' };
  const m = BOND_CUT.exec(s);
  let prefix = m && m.index > 3 ? s.slice(0, m.index) : s;
  prefix = prefix.replace(/[^A-Z0-9&/ ]+/g, ' ');
  prefix = pyStrip(prefix.replace(/[\s\x1c-\x1f]+/g, ' '));
  const strong = MUNI_STRONG.test(s);
  const weakSet = new Set<string>();
  for (const w of prefix.matchAll(MUNI_WEAK)) weakSet.add(w[1]);
  const weak = weakSet.size;
  if (strong || weak >= 2 || (weak >= 1 && US_STATES.test(prefix))) return { kind: 'municipal', key: prefix || s.slice(0, 60) };
  if (CORP_WORD.test(prefix)) return { kind: 'corporate', key: looseTokens(prefix).join(' ') };
  return { kind: 'undetermined', key: prefix || s.slice(0, 60) };
}
/** The key of a fund/ETF description. */
export function fundKey(asset: string): string {
  return looseTokens(asset.split(FUND_CUT)[0]).join(' ');
}
/** The issuer key of one President transaction line, by the class printed on the line (w1a_issuers.stage_keys). */
export function execIssuerKey(printedClass: string | null, asset: string): { key: string; kind: BondKind | '' } {
  if (printedClass === 'bond') {
    const b = bondKind(asset);
    return { key: b.key, kind: b.kind };
  }
  if (printedClass === 'fund') return { key: fundKey(asset), kind: '' };
  return { key: issuerStockKey(asset), kind: '' };
}
/** The key of a congress_trades row is its ticker. */
export const congressIssuerKey = (ticker: string | null | undefined): string => (ticker ?? '').trim().toUpperCase();

// ---------------------------------------------------------------- issuer map and groups (pre-registration section 3)

export type IssuerMap = Map<string, IssuerRow[]>;
export function buildIssuerMap(rows: readonly IssuerRow[]): IssuerMap {
  const m: IssuerMap = new Map();
  for (const r of rows) {
    const k = `${r.source_table}|${r.issuer_key}`;
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}
const INSTRUMENT_OF_PRINTED: Record<string, string> = { stock: 'stock', bond: 'bond', fund: 'fund/ETF' };
export type IssuerLookup = { ref: IssuerRow | null; why: 'one' | 'by_instrument' | 'fund_entity' | 'ambiguous' | 'missing' };
/** The classification row for a key. A key can hold one row per instrument; the printed class picks the row, else a fund/ETF row, else none. */
export function lookupIssuer(map: IssuerMap, table: string, key: string, printed: string): IssuerLookup {
  const c = map.get(`${table}|${key}`);
  if (!c || c.length === 0) return { ref: null, why: 'missing' };
  if (c.length === 1) return { ref: c[0], why: 'one' };
  const want = INSTRUMENT_OF_PRINTED[printed] ?? printed;
  const exact = c.filter((r) => r.instrument === want);
  if (exact.length === 1) return { ref: exact[0], why: 'by_instrument' };
  const fund = c.filter((r) => r.instrument === 'fund/ETF');
  if (fund.length === 1) return { ref: fund[0], why: 'fund_entity' };
  return { ref: null, why: 'ambiguous' };
}

export type Instrument = 'stock' | 'bond' | 'fund/ETF' | 'unmapped';
/** ED = in energy (E), defense by industry (D-SIC) or defense by federal money (D-DoD); unclassified is never guessed (A2). */
export type GroupClass = 'ED' | 'other' | 'unclassified';
export interface GroupFlags { cls: GroupClass; isE: boolean; isDSic: boolean; isDDod: boolean }
export function groupOf(ref: IssuerRow | null): GroupFlags {
  if (!ref) return { cls: 'unclassified', isE: false, isDSic: false, isDDod: false };
  const isE = ref.group_e === 'E';
  const isDSic = ref.group_d_sic === 'D-SIC';
  const isDDod = ref.group_d_dod === 'D-DoD';
  if (isE || isDSic || isDDod) return { cls: 'ED', isE, isDSic, isDDod };
  const unc = ref.group_e === 'unclassified' || ref.group_d_sic === 'unclassified' || ref.group_d_dod === 'unclassified';
  return { cls: unc ? 'unclassified' : 'other', isE, isDSic, isDDod };
}
function instrumentOf(ref: IssuerRow | null): Instrument {
  if (!ref) return 'unmapped';
  return ref.instrument === 'stock' || ref.instrument === 'bond' || ref.instrument === 'fund/ETF' ? ref.instrument : 'unmapped';
}

// ---------------------------------------------------------------- one enriched transaction

export type TxType = 'purchase' | 'sale' | 'exchange';
export interface Tx {
  id: string;
  date: string;
  month: string;
  win: WindowKey | null;
  type: TxType;
  inst: Instrument;
  cls: GroupClass;
  isE: boolean;
  isDSic: boolean;
  isDDod: boolean;
  sicMajor: string | null;
  min: number;
  max: number;
  late: boolean | null;
  days: number | null;
  /** Executive: the OGE report; congress: the filing document. */
  doc: string;
  /** Days from the trade to OGE's posting of its report (executive only). */
  posted: string | null;
  daysToPost: number | null;
  /** Printed name (executive asset or congress company name). */
  name: string;
  key: string;
  lookup: IssuerLookup['why'];
  member?: string;
  option?: boolean;
}

function execType(t: string): TxType {
  return t === 'purchase' ? 'purchase' : t === 'sale' ? 'sale' : 'exchange';
}
function congressType(t: string): TxType {
  return /^buy|^purchase/i.test(t) ? 'purchase' : /^sell|^sale/i.test(t) ? 'sale' : 'exchange';
}

export function enrichExec(rows: readonly ExecRow[], filings: readonly FilingRow[], map: IssuerMap): Tx[] {
  const posted = new Map(filings.map((f) => [f.source_doc_id, f.oge_posted_date]));
  return rows.map((r) => {
    const printed = r.instrument_class ?? 'stock';
    const { key } = execIssuerKey(printed, r.asset);
    const look = lookupIssuer(map, 'executive_trades', key, printed);
    const g = groupOf(look.ref);
    const p = posted.get(r.source_doc_id) ?? null;
    return {
      id: r.id, date: r.transaction_date, month: r.transaction_date.slice(0, 7), win: windowOf(r.transaction_date), type: execType(r.transaction_type),
      inst: instrumentOf(look.ref), cls: g.cls, isE: g.isE, isDSic: g.isDSic, isDDod: g.isDDod, sicMajor: look.ref?.sic_major || null,
      min: Number(r.amount_min ?? 0), max: Number(r.amount_max ?? 0), late: r.stock_act_late, days: r.days_to_file, doc: r.source_doc_id,
      posted: p, daysToPost: p ? daysBetween(r.transaction_date, p) : null, name: r.asset.replace(/\s+/g, ' ').trim(), key, lookup: look.why,
    };
  });
}

export function enrichCongress(rows: readonly CongressRow[], map: IssuerMap): Tx[] {
  return rows.map((r) => {
    const key = congressIssuerKey(r.ticker);
    const look = lookupIssuer(map, 'congress_trades', key, 'stock');
    const g = groupOf(look.ref);
    return {
      id: r.id, date: r.transaction_date, month: r.transaction_date.slice(0, 7), win: windowOf(r.transaction_date), type: congressType(r.transaction_type),
      inst: instrumentOf(look.ref), cls: g.cls, isE: g.isE, isDSic: g.isDSic, isDDod: g.isDDod, sicMajor: look.ref?.sic_major || null,
      min: Number(r.amount_min ?? 0), max: Number(r.amount_max ?? 0), late: r.stock_act_late, days: r.days_to_file, doc: r.disclosure_url ?? '',
      posted: null, daysToPost: null, name: (r.company_name ?? r.ticker ?? '').replace(/\s+/g, ' ').trim(), key, lookup: look.why, member: r.member_id,
      option: r.instrument === 'option',
    };
  });
}

// ---------------------------------------------------------------- M1 / M2: counts and band ranges

export interface Cell { n: number; purchases: number; sales: number; exchanges: number; minSum: number; maxSum: number }
export const emptyCell = (): Cell => ({ n: 0, purchases: 0, sales: 0, exchanges: 0, minSum: 0, maxSum: 0 });
export function cellOf(rows: readonly Tx[]): Cell {
  const c = emptyCell();
  for (const t of rows) {
    c.n += 1;
    if (t.type === 'purchase') c.purchases += 1;
    else if (t.type === 'sale') c.sales += 1;
    else c.exchanges += 1;
    c.minSum += t.min;
    c.maxSum += t.max;
  }
  return c;
}

export interface GroupTable {
  all: Cell;
  byInstrument: Record<Instrument, Cell>;
  /** Energy, defense by industry, defense by federal money: the flags overlap, so these can sum to more than ED. */
  E: Cell; DSic: Cell; DDod: Cell;
  /** Any of the three. */
  ED: Cell;
  other: Cell;
  unclassified: Cell;
  /** Stock transactions only (option lines are counted in `options`), split by group (the M3 population before the purchase/sale cut). */
  stock: { ED: Cell; other: Cell; unclassified: Cell };
  /** Option lines (congress only: the stored instrument column marks them). They are not stock purchases and sit out of M3. */
  options: Cell;
}
export function groupTable(rows: readonly Tx[]): GroupTable {
  const by = (f: (t: Tx) => boolean) => cellOf(rows.filter(f));
  const stock = rows.filter((t) => t.inst === 'stock' && !t.option);
  return {
    all: cellOf(rows),
    options: by((t) => !!t.option),
    byInstrument: { stock: by((t) => t.inst === 'stock' && !t.option), bond: by((t) => t.inst === 'bond'), 'fund/ETF': by((t) => t.inst === 'fund/ETF'), unmapped: by((t) => t.inst === 'unmapped') },
    E: by((t) => t.isE), DSic: by((t) => t.isDSic), DDod: by((t) => t.isDDod),
    ED: by((t) => t.cls === 'ED'), other: by((t) => t.cls === 'other'), unclassified: by((t) => t.cls === 'unclassified'),
    stock: { ED: cellOf(stock.filter((t) => t.cls === 'ED')), other: cellOf(stock.filter((t) => t.cls === 'other')), unclassified: cellOf(stock.filter((t) => t.cls === 'unclassified')) },
  };
}

/** Trade months with data: Jan 2025 to Jul 2026. */
export const MONTHS: readonly string[] = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
];

// ---------------------------------------------------------------- M3: the one test (Fisher exact, two-sided, log-combinations)

const logFactCache: number[] = [0];
function logFact(n: number): number {
  for (let i = logFactCache.length; i <= n; i++) logFactCache[i] = logFactCache[i - 1] + Math.log(i);
  return logFactCache[n];
}
const logChoose = (n: number, k: number): number => logFact(n) - logFact(k) - logFact(n - k);

/**
 * Two-sided Fisher exact test on [[a, b], [c, d]]: the sum of the probabilities of every table with the same margins that is no more
 * likely than the observed one (relative tolerance 1e-7, as R and SciPy). Probabilities come from log-combinations.
 */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const n1 = a + b;
  const n2 = c + d;
  const k = a + c;
  const N = n1 + n2;
  if (N === 0 || n1 === 0 || n2 === 0 || k === 0 || k === N) return 1;
  const lo = Math.max(0, k - n2);
  const hi = Math.min(k, n1);
  const denom = logChoose(N, k);
  const logp = (x: number) => logChoose(n1, x) + logChoose(n2, k - x) - denom;
  const pObs = Math.exp(logp(a));
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const px = Math.exp(logp(x));
    if (px <= pObs * (1 + 1e-7)) p += px;
  }
  return Math.min(1, p);
}

export interface M3Side { ed: number; other: number; unclassified: number }
export interface M3Result {
  a: M3Side;
  b: M3Side;
  shareA: number | null;
  shareB: number | null;
  p: number;
  significant: boolean;
  direction: 'higher' | 'lower' | 'same';
  /** A2 bounds: every unclassified issuer counted as not E/D, then as E/D. */
  lowerBound: { p: number; significant: boolean };
  upperBound: { p: number; significant: boolean };
  boundsChangeSignificance: boolean;
  /** The most unclassified stock purchases (both windows) held by one member; 0 when the rows carry no member (the President). */
  topUnclassified: number;
}
function sideOf(rows: readonly Tx[]): M3Side {
  return { ed: rows.filter((t) => t.cls === 'ED').length, other: rows.filter((t) => t.cls === 'other').length, unclassified: rows.filter((t) => t.cls === 'unclassified').length };
}
/** M3: among stock purchases (operating companies) the share in E, D-SIC or D-DoD, window A against window B. Unclassified issuers sit out (A2). */
export function m3(rows: readonly Tx[], winA: WindowKey, winB: WindowKey, type: 'purchase' | 'sale' = 'purchase'): M3Result {
  const pick = (w: WindowKey) => rows.filter((t) => t.win === w && t.inst === 'stock' && !t.option && t.type === type);
  const a = sideOf(pick(winA));
  const b = sideOf(pick(winB));
  const p = fisherExact(a.ed, a.other, b.ed, b.other);
  const pLow = fisherExact(a.ed, a.other + a.unclassified, b.ed, b.other + b.unclassified);
  const pHigh = fisherExact(a.ed + a.unclassified, a.other, b.ed + b.unclassified, b.other);
  const shareA = a.ed + a.other ? a.ed / (a.ed + a.other) : null;
  const shareB = b.ed + b.other ? b.ed / (b.ed + b.other) : null;
  const sig = p < ALPHA;
  const perMember = new Map<string, number>();
  for (const t of [...pick(winA), ...pick(winB)]) if (t.cls === 'unclassified' && t.member) perMember.set(t.member, (perMember.get(t.member) ?? 0) + 1);
  const direction = shareA === null || shareB === null || shareA === shareB ? 'same' : shareB > shareA ? 'higher' : 'lower';
  return {
    a, b, shareA, shareB, p, significant: sig, direction,
    lowerBound: { p: pLow, significant: pLow < ALPHA },
    upperBound: { p: pHigh, significant: pHigh < ALPHA },
    boundsChangeSignificance: pLow < ALPHA !== sig || pHigh < ALPHA !== sig,
    topUnclassified: Math.max(0, ...perMember.values()),
  };
}

// ---------------------------------------------------------------- M5: when the public could see it

/** Days from trade to report, in bins that carry no verdict (same bins as /president/timing). */
export const DAY_BINS = [
  { key: 'd30', label: '30 or fewer', min: 0, max: 30 },
  { key: 'd45', label: '31 to 45', min: 31, max: 45 },
  { key: 'd60', label: '46 to 60', min: 46, max: 60 },
  { key: 'd90', label: '61 to 90', min: 61, max: 90 },
  { key: 'd120', label: '91 to 120', min: 91, max: 120 },
  { key: 'd180', label: '121 to 180', min: 121, max: 180 },
  { key: 'd181', label: '181 or more', min: 181, max: Infinity },
] as const;
export function binIndex(days: number): number {
  const i = DAY_BINS.findIndex((b) => days >= b.min && days <= b.max);
  return i < 0 ? DAY_BINS.length - 1 : i;
}
export interface BinCount { key: string; label: string; count: number; over45: boolean }
function binCounts(values: readonly number[]): BinCount[] {
  const counts = DAY_BINS.map(() => 0);
  for (const v of values) counts[binIndex(v)] += 1;
  return DAY_BINS.map((b, i) => ({ key: b.key, label: b.label, count: counts[i], over45: b.min > 45 }));
}

export interface Disclosure {
  n: number;
  /** Rows with a computed gap (the filer-signature gap is not computed for the 278-T exempt holdings). */
  computed: number;
  over45: number;
  notComputed: number;
  signBins: BinCount[];
  maxDaysToSign: number | null;
  postBins: BinCount[];
  maxDaysToPost: number | null;
}
export function disclosureOf(rows: readonly Tx[]): Disclosure {
  const signed = rows.filter((t) => t.days != null && t.late != null);
  const posted = rows.filter((t) => t.daysToPost != null);
  return {
    n: rows.length,
    computed: signed.length,
    over45: rows.filter((t) => t.late === true).length,
    notComputed: rows.filter((t) => t.late == null).length,
    signBins: binCounts(signed.map((t) => t.days as number)),
    maxDaysToSign: signed.length ? Math.max(...signed.map((t) => t.days as number)) : null,
    postBins: binCounts(posted.map((t) => t.daysToPost as number)),
    maxDaysToPost: posted.length ? Math.max(...posted.map((t) => t.daysToPost as number)) : null,
  };
}

export interface PostingMonth {
  month: string;
  total: number;
  firstPosted: string | null;
  /** How many of the month's transactions each OGE posting date made public, earliest first. */
  byPosting: { date: string; count: number }[];
}
export function postingByMonth(rows: readonly Tx[], months: readonly string[]): PostingMonth[] {
  return months.map((month) => {
    const list = rows.filter((t) => t.month === month);
    const m = new Map<string, number>();
    for (const t of list) if (t.posted) m.set(t.posted, (m.get(t.posted) ?? 0) + 1);
    const byPosting = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
    return { month, total: list.length, firstPosted: byPosting[0]?.date ?? null, byPosting };
  });
}

export interface ReportLabel { docId: string; url: string; label: string; signed: string | null; posted: string | null }
function fileNameOfUrl(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop() ?? '').replace(/\.pdf$/i, '');
  } catch {
    return url;
  }
}
export function reportLabel(f: Pick<FilingRow, 'disclosure_url' | 'filer_signed_date'>): string {
  const n = /\((\d)\)/.exec(fileNameOfUrl(f.disclosure_url))?.[1];
  return `278-T signed ${fmtDate(f.filer_signed_date) ?? 'date not read'}${n ? ` (${n})` : ''}`;
}
export interface FeeCover {
  docId: string;
  url: string;
  label: string;
  comment: string;
  opinionDate: string | null;
  /** The comment's page and line on the cover, when read. */
  refPage: number | null;
  refLine: number | null;
  coverPage: number | null;
  postedDate: string | null;
  /** Rows of this report in each window. */
  rows: Record<WindowKey, number>;
}
/** The reports that hold rows in a window and whose cover carries the "Filer paid late fee(s)" note (M5), quoted as stored. */
export function feeCovers(tx: readonly Tx[], filings: readonly FilingRow[]): FeeCover[] {
  const out: FeeCover[] = [];
  for (const f of filings) {
    if (f.reviewer_comment_kind !== 'late_fee_note' || !f.reviewer_comment) continue;
    const rows: Record<WindowKey, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const t of tx) if (t.doc === f.source_doc_id && t.win) rows[t.win] += 1;
    if (rows.P1 + rows.P2 + rows.P3 === 0) continue;
    out.push({
      docId: f.source_doc_id, url: f.disclosure_url, label: reportLabel(f), comment: f.reviewer_comment, opinionDate: f.daeo_signed_date,
      refPage: f.reviewer_comment_ref_page, refLine: f.reviewer_comment_ref_line, coverPage: f.cover_page, postedDate: f.oge_posted_date, rows,
    });
  }
  return out.sort((a, b) => (a.postedDate ?? '').localeCompare(b.postedDate ?? '') || a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------- the sector mix (pre-registration section 3, last bullets)

/** SEC SIC major groups (two digits), the labels of the SIC manual. */
export const SIC_MAJOR_LABEL: Record<string, string> = {
  '01': 'Agricultural production: crops', '02': 'Agricultural production: livestock and animal specialties', '07': 'Agricultural services', '08': 'Forestry',
  '09': 'Fishing, hunting and trapping', '10': 'Metal mining', '12': 'Coal mining', '13': 'Oil and gas extraction', '14': 'Mining and quarrying of nonmetallic minerals, except fuels',
  '15': 'Building construction: general contractors and operative builders', '16': 'Heavy construction other than building construction: contractors', '17': 'Construction: special trade contractors',
  '20': 'Food and kindred products', '21': 'Tobacco products', '22': 'Textile mill products', '23': 'Apparel and other finished products made from fabrics and similar materials',
  '24': 'Lumber and wood products, except furniture', '25': 'Furniture and fixtures', '26': 'Paper and allied products', '27': 'Printing, publishing and allied industries',
  '28': 'Chemicals and allied products', '29': 'Petroleum refining and related industries', '30': 'Rubber and miscellaneous plastics products', '31': 'Leather and leather products',
  '32': 'Stone, clay, glass and concrete products', '33': 'Primary metal industries', '34': 'Fabricated metal products, except machinery and transportation equipment',
  '35': 'Industrial and commercial machinery and computer equipment', '36': 'Electronic and other electrical equipment and components, except computer equipment',
  '37': 'Transportation equipment', '38': 'Measuring, analyzing and controlling instruments; photographic, medical and optical goods; watches and clocks',
  '39': 'Miscellaneous manufacturing industries', '40': 'Railroad transportation', '41': 'Local and suburban transit and interurban highway passenger transportation',
  '42': 'Motor freight transportation and warehousing', '44': 'Water transportation', '45': 'Transportation by air', '46': 'Pipelines, except natural gas', '47': 'Transportation services',
  '48': 'Communications', '49': 'Electric, gas and sanitary services', '50': 'Wholesale trade: durable goods', '51': 'Wholesale trade: nondurable goods',
  '52': 'Building materials, hardware, garden supply and mobile home dealers', '53': 'General merchandise stores', '54': 'Food stores', '55': 'Automotive dealers and gasoline service stations',
  '56': 'Apparel and accessory stores', '57': 'Home furniture, furnishings and equipment stores', '58': 'Eating and drinking places', '59': 'Miscellaneous retail',
  '60': 'Depository institutions', '61': 'Nondepository credit institutions', '62': 'Security and commodity brokers, dealers, exchanges and services', '63': 'Insurance carriers',
  '64': 'Insurance agents, brokers and service', '65': 'Real estate', '67': 'Holding and other investment offices', '70': 'Hotels, rooming houses, camps and other lodging places',
  '72': 'Personal services', '73': 'Business services', '75': 'Automotive repair, services and parking', '76': 'Miscellaneous repair services', '78': 'Motion pictures',
  '79': 'Amusement and recreation services', '80': 'Health services', '81': 'Legal services', '82': 'Educational services', '83': 'Social services',
  '86': 'Membership organizations', '87': 'Engineering, accounting, research, management and related services', '89': 'Services, not elsewhere classified',
  '99': 'Nonclassifiable establishments',
};
export interface SicRow { major: string; label: string; purchases: number; sales: number; n: number; ed: boolean }
/** Stocks by SIC major group in a window; issuers with no SIC stay in their own "unclassified" row. */
export function sicMix(rows: readonly Tx[], win: WindowKey): SicRow[] {
  const m = new Map<string, SicRow>();
  for (const t of rows) {
    if (t.win !== win || t.inst !== 'stock') continue;
    const major = t.sicMajor ?? 'unclassified';
    const e = m.get(major) ?? { major, label: major === 'unclassified' ? 'Unclassified: no SEC industry code found for the issuer' : (SIC_MAJOR_LABEL[major] ?? `SIC major group ${major}`), purchases: 0, sales: 0, n: 0, ed: false };
    e.n += 1;
    if (t.type === 'purchase') e.purchases += 1;
    else if (t.type === 'sale') e.sales += 1;
    if (t.cls === 'ED') e.ed = true;
    m.set(major, e);
  }
  return [...m.values()].sort((a, b) => (a.major === 'unclassified' ? 1 : b.major === 'unclassified' ? -1 : b.n - a.n || a.major.localeCompare(b.major)));
}
export interface FundRow { name: string; purchases: number; sales: number; n: number; energyName: boolean; /** The printed name spells "ENRGY": the name rule does not count it (AW1 should-fix 8). */ enrgySpelling: boolean }
const FUND_ENERGY_WORDS = /\b(ENERGY|OIL|GAS|PETROLEUM)\b/;
/** Every fund/ETF line in a window, by printed name. */
export function fundList(rows: readonly Tx[], win: WindowKey): FundRow[] {
  const m = new Map<string, FundRow>();
  for (const t of rows) {
    if (t.win !== win || t.inst !== 'fund/ETF') continue;
    const e = m.get(t.name) ?? { name: t.name, purchases: 0, sales: 0, n: 0, energyName: FUND_ENERGY_WORDS.test(t.name.toUpperCase()), enrgySpelling: !FUND_ENERGY_WORDS.test(t.name.toUpperCase()) && /\bENRGY\b/.test(t.name.toUpperCase()) };
    e.n += 1;
    if (t.type === 'purchase') e.purchases += 1;
    else if (t.type === 'sale') e.sales += 1;
    m.set(t.name, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- the days (timeline, M4)

export interface DayAgg {
  date: string;
  chron: { government: number; president_post: number; oversight: number; labelled: number };
  /** Executive transactions with this trade date. */
  purchases: Record<GroupClass, number>;
  sales: Record<GroupClass, number>;
  exchanges: number;
  total: number;
  brent: number | null;
  wti: number | null;
}
const emptyByClass = (): Record<GroupClass, number> => ({ ED: 0, other: 0, unclassified: 0 });
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export function buildDays(chron: readonly ChronRow[], tx: readonly Tx[], eia: readonly EiaRow[], from = AXIS_START, to = AXIS_END): DayAgg[] {
  const days = new Map<string, DayAgg>();
  for (const d of dateRange(from, to)) {
    days.set(d, { date: d, chron: { government: 0, president_post: 0, oversight: 0, labelled: 0 }, purchases: emptyByClass(), sales: emptyByClass(), exchanges: 0, total: 0, brent: null, wti: null });
  }
  for (const c of chron) {
    const d = days.get(c.event_date);
    if (!d) continue;
    if (c.lane === 'government' || c.lane === 'president_post' || c.lane === 'oversight') d.chron[c.lane] += 1;
    if (c.labelled_marker) d.chron.labelled += 1;
  }
  for (const t of tx) {
    const d = days.get(t.date);
    if (!d) continue;
    d.total += 1;
    if (t.type === 'purchase') d.purchases[t.cls] += 1;
    else if (t.type === 'sale') d.sales[t.cls] += 1;
    else d.exchanges += 1;
  }
  for (const e of eia) {
    const d = days.get(e.price_date);
    if (!d || e.usd_per_bbl == null) continue;
    if (e.series === 'RBRTE') d.brent = Number(e.usd_per_bbl);
    else if (e.series === 'RWTC') d.wti = Number(e.usd_per_bbl);
  }
  return [...days.values()];
}

export interface DatedEvent {
  date: string;
  government: number;
  president_post: number;
  oversight: number;
  total: number;
  edPurchases: number;
  edSales: number;
  /** True when the reports list no E/D transaction on this date: the table prints "none reported on this date" (section 6). */
  noneReported: boolean;
}
/** M4: for each chronology date inside the axis, the transactions with that trade date, by group. */
export function datedEvents(days: readonly DayAgg[]): DatedEvent[] {
  return days
    .filter((d) => d.chron.government + d.chron.president_post + d.chron.oversight > 0)
    .map((d) => ({
      date: d.date, government: d.chron.government, president_post: d.chron.president_post, oversight: d.chron.oversight, total: d.total,
      edPurchases: d.purchases.ED, edSales: d.sales.ED, noneReported: d.purchases.ED + d.sales.ED === 0,
    }));
}

/** A short label for a labelled marker: the first ~90 characters of the summary, cut at a word. */
export function shortLabel(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).replace(/[ ,;:.—-]+$/, '')}…`;
}
export interface Marker {
  id: string;
  date: string;
  time: string | null;
  lane: 'government' | 'president_post' | 'oversight';
  labelled: boolean;
  label: string | null;
}
export function markersOf(chron: readonly ChronRow[], from = AXIS_START, to = AXIS_END): { markers: Marker[]; outside: ChronRow[] } {
  const markers: Marker[] = [];
  const outside: ChronRow[] = [];
  for (const c of chron) {
    if (c.event_date < from || c.event_date > to) {
      outside.push(c);
      continue;
    }
    if (c.lane !== 'government' && c.lane !== 'president_post' && c.lane !== 'oversight') continue;
    markers.push({ id: c.id, date: c.event_date, time: c.event_time_et ? c.event_time_et.slice(0, 5) : null, lane: c.lane, labelled: c.labelled_marker, label: c.labelled_marker ? shortLabel(c.event_text) : null });
  }
  markers.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.id.localeCompare(b.id));
  return { markers, outside };
}

// ---------------------------------------------------------------- the Congress companion (Q7, no party test)

export interface MemberRow {
  memberId: string;
  name: string;
  chamber: string;
  party: string;
  state: string;
  bioguide: string | null;
  /** Transactions by window. */
  byWindow: Record<'P1' | 'P2' | 'P3', number>;
  /** Transactions in an energy or defense group, by window. */
  edByWindow: Record<'P1' | 'P2' | 'P3', number>;
  purchases: number;
  sales: number;
  exchanges: number;
  over45: number;
  total: number;
}
const SUFFIX = /^(JR|SR|II|III|IV|V)\.?$/i;
export function surnameKey(name: string): string {
  const parts = name.replace(/,/g, ' ').trim().split(/\s+/).filter((w) => !SUFFIX.test(w));
  const last = parts[parts.length - 1] ?? name;
  return `${last.toLowerCase()} ${name.toLowerCase()}`;
}
export function memberRows(rows: readonly CongressRow[], tx: readonly Tx[]): MemberRow[] {
  const byId = new Map<string, MemberRow>();
  const txById = new Map(tx.map((t) => [t.id, t]));
  for (const r of rows) {
    const t = txById.get(r.id);
    const w = t?.win;
    if (!t || (w !== 'P1' && w !== 'P2' && w !== 'P3')) continue;
    const m = byId.get(r.member_id) ?? {
      memberId: r.member_id, name: r.member_name, chamber: r.member_chamber, party: r.member_party ?? 'Not stated', state: r.member_state ?? '', bioguide: r.bio_guide_id,
      byWindow: { P1: 0, P2: 0, P3: 0 }, edByWindow: { P1: 0, P2: 0, P3: 0 }, purchases: 0, sales: 0, exchanges: 0, over45: 0, total: 0,
    };
    m.total += 1;
    m.byWindow[w] += 1;
    if (t.cls === 'ED') m.edByWindow[w] += 1;
    if (t.type === 'purchase') m.purchases += 1;
    else if (t.type === 'sale') m.sales += 1;
    else m.exchanges += 1;
    if (t.late === true) m.over45 += 1;
    byId.set(r.member_id, m);
  }
  return [...byId.values()].sort((a, b) => surnameKey(a.name).localeCompare(surnameKey(b.name)));
}

export interface CongressGroup {
  label: string;
  windows: Record<'P1' | 'P2' | 'P3', GroupTable>;
  disclosure: Record<'P1' | 'P2' | 'P3', Disclosure>;
  m3: M3Result;
  m3Sales: M3Result;
  members: number;
}

// ---------------------------------------------------------------- everything

export interface PresidentFigures {
  total: number;
  reports: number;
  windows: Record<WindowKey, GroupTable>;
  monthly: { month: string; table: GroupTable }[];
  m3: M3Result;
  m3Sales: M3Result;
  sicMix: { P1: SicRow[]; P2: SicRow[] };
  funds: { P1: FundRow[]; P2: FundRow[] };
  disclosure: Record<WindowKey, Disclosure>;
  posting: PostingMonth[];
  fees: FeeCover[];
  /** Reports that hold at least one transaction dated in the three 2026 windows. */
  reportsInWindows: number;
  dated: DatedEvent[];
  /** Rows the issuer map could not place: never guessed, shown as unclassified, counted here. */
  unmapped: number;
  ambiguous: number;
  /** Executive rows with a trade date outside every window (0 expected). */
  outsideWindows: number;
  firstTrade: string | null;
  lastTrade: string | null;
}
export interface IranWarFigures {
  president: PresidentFigures;
  congress: { pooled: CongressGroup; house: CongressGroup; senate: CongressGroup; members: MemberRow[]; unmapped: number; optionRows: number; dataThrough: string | null };
  days: DayAgg[];
  markers: Marker[];
  outsideAxis: { id: string; date: string; lane: string }[];
  chronology: { total: number; byLane: Record<string, number>; labelled: number; labelledPosts: number };
  brent: { date: string; value: number }[];
  wti: { date: string; value: number }[];
}

function congressGroup(label: string, tx: readonly Tx[], memberCount: number): CongressGroup {
  const win = (w: 'P1' | 'P2' | 'P3') => tx.filter((t) => t.win === w);
  return {
    label,
    windows: { P1: groupTable(win('P1')), P2: groupTable(win('P2')), P3: groupTable(win('P3')) },
    disclosure: { P1: disclosureOf(win('P1')), P2: disclosureOf(win('P2')), P3: disclosureOf(win('P3')) },
    m3: m3(tx, 'P1', 'P2', 'purchase'),
    m3Sales: m3(tx, 'P1', 'P2', 'sale'),
    members: memberCount,
  };
}

export function computeIranWar(inp: IranWarInputs): IranWarFigures {
  const map = buildIssuerMap(inp.issuers);
  const ex = enrichExec(inp.exec, inp.filings, map);
  const cg = enrichCongress(inp.congress, map);
  const win = (rows: readonly Tx[], w: WindowKey) => rows.filter((t) => t.win === w);
  const dates = inp.exec.map((r) => r.transaction_date).sort();
  const days = buildDays(inp.chron, ex, inp.eia);
  const { markers, outside } = markersOf(inp.chron);
  const byLane: Record<string, number> = {};
  for (const c of inp.chron) byLane[c.lane] = (byLane[c.lane] ?? 0) + 1;
  const series = (s: string) => inp.eia.filter((e) => e.series === s && e.usd_per_bbl != null).sort((a, b) => a.price_date.localeCompare(b.price_date)).map((e) => ({ date: e.price_date, value: Number(e.usd_per_bbl) }));
  const chamberById = new Map(inp.congress.map((r) => [r.id, r.member_chamber]));
  const house = cg.filter((t) => chamberById.get(t.id) === 'House');
  const senate = cg.filter((t) => chamberById.get(t.id) === 'Senate');
  const members = memberRows(inp.congress, cg);
  const memberIds = (rows: readonly Tx[]) => new Set(rows.filter((t) => t.win).map((t) => t.member)).size;
  const reportsHolding = new Set(ex.filter((t) => t.win === 'P1' || t.win === 'P2' || t.win === 'P3').map((t) => t.doc));
  return {
    president: {
      total: ex.length,
      reports: new Set(ex.map((t) => t.doc)).size,
      windows: { P0: groupTable(win(ex, 'P0')), P1: groupTable(win(ex, 'P1')), P2: groupTable(win(ex, 'P2')), P3: groupTable(win(ex, 'P3')) },
      monthly: MONTHS.map((month) => ({ month, table: groupTable(ex.filter((t) => t.month === month)) })),
      m3: m3(ex, 'P1', 'P2', 'purchase'),
      m3Sales: m3(ex, 'P1', 'P2', 'sale'),
      sicMix: { P1: sicMix(ex, 'P1'), P2: sicMix(ex, 'P2') },
      funds: { P1: fundList(ex, 'P1'), P2: fundList(ex, 'P2') },
      disclosure: { P0: disclosureOf(win(ex, 'P0')), P1: disclosureOf(win(ex, 'P1')), P2: disclosureOf(win(ex, 'P2')), P3: disclosureOf(win(ex, 'P3')) },
      posting: postingByMonth(ex, MONTHS.filter((m) => m >= '2026-01')),
      fees: feeCovers(ex, inp.filings.filter((f) => reportsHolding.has(f.source_doc_id))),
      reportsInWindows: reportsHolding.size,
      dated: datedEvents(days),
      unmapped: ex.filter((t) => t.lookup === 'missing').length,
      ambiguous: ex.filter((t) => t.lookup === 'ambiguous').length,
      outsideWindows: ex.filter((t) => t.win === null).length,
      firstTrade: dates[0] ?? null,
      lastTrade: dates[dates.length - 1] ?? null,
    },
    congress: {
      pooled: congressGroup('All members', cg, memberIds(cg)),
      house: congressGroup('House', house, memberIds(house)),
      senate: congressGroup('Senate', senate, memberIds(senate)),
      members,
      unmapped: cg.filter((t) => t.lookup === 'missing' || t.lookup === 'ambiguous').length,
      optionRows: cg.filter((t) => t.option).length,
      dataThrough: inp.congress.map((r) => r.transaction_date).sort().pop() ?? null,
    },
    days,
    markers,
    outsideAxis: outside.map((c) => ({ id: c.id, date: c.event_date, lane: c.lane })),
    chronology: {
      total: inp.chron.length,
      byLane,
      labelled: inp.chron.filter((c) => c.labelled_marker).length,
      labelledPosts: inp.chron.filter((c) => c.labelled_marker && c.lane === 'president_post').length,
    },
    brent: series('RBRTE'),
    wti: series('RWTC'),
  };
}
