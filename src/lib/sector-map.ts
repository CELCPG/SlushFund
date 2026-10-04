// Shared sector classification — used by both the Political Trading page
// and the server-side summary endpoint. Keep this file dependency-free
// (no React, no Next imports) so it works in API route handlers.

export const SECTOR_COLORS: Record<string, string> = {
  'AI / Tech': '#8b5cf6',
  'AI / Chips': '#06b6d4',
  'Defense': '#ef4444',
  'Aerospace': '#f97316',
  'Oil & Gas': '#fbbf24',
  'Renewable Energy': '#22c55e',
  'Finance': '#10b981',
  'Financial Services': '#14b8a6',
  'AdTech / Data': '#ec4899',
  'Specialty Chemicals': '#f97316',
  'Building Materials': '#fb923c',
  'Staffing & HR': '#a78bfa',
  'Insurance': '#38bdf8',
  'Food & Agriculture': '#a3e635',
  'Infrastructure & Engineering': '#94a3b8',
  'Biotech': '#ec4899',
  'Medical Devices': '#06b6d4',
  'Pharma': '#f43f5e',
  'Media': '#a855f7',
  'Telecom': '#3b82f6',
  'Real Estate': '#f59e0b',
  'Consumer': '#84cc16',
  'Automotive': '#eab308',
  'Industrials': '#64748b',
  'Payment Processing': '#2dd4bf',
  'Crypto': '#f97316',
  'ETFs': '#475569',
  'Restaurants & Hospitality': '#fb923c',
  'Logistics & Delivery': '#f97316',
  'Packaging & Containers': '#94a3b8',
  'Environmental Services': '#22c55e',
  'Business Services': '#64748b',
  'Consumer Internet': '#8b5cf6',
  'Construction Materials': '#fb923c',
  'Investment Holdings': '#14b8a6',
  'Energy': '#fbbf24',
  'Cybersecurity': '#ef4444',
  'Catch-All / Misc': '#475569',
};

export const TICKER_SECTORS: Record<string, string> = {
  // ── AI / Tech ──────────────────────────────────────────────────────────────
  MSFT: 'AI / Tech', GOOGL: 'AI / Tech', GOOG: 'AI / Tech', META: 'AI / Tech',
  AMZN: 'AI / Tech', AAPL: 'AI / Tech', CRM: 'AI / Tech',
  ORCL: 'AI / Tech', IBM: 'AI / Tech', ADBE: 'AI / Tech', SNOW: 'AI / Tech',
  UBER: 'AI / Tech', SHOP: 'AI / Tech', SQ: 'AI / Tech', SPOT: 'AI / Tech',
  SNAP: 'AI / Tech', PIN: 'AI / Tech', MTCH: 'AI / Tech',
  NOW: 'AI / Tech', WDAY: 'AI / Tech', APP: 'AI / Tech', DDOG: 'AI / Tech',
  HOOD: 'AI / Tech', EPAM: 'AI / Tech', CTSH: 'AI / Tech', ACN: 'AI / Tech',
  GEN: 'AI / Tech', CSGP: 'AI / Tech', INTU: 'AI / Tech',
  TRMB: 'AI / Tech', FICO: 'AI / Tech', JKHY: 'AI / Tech', GDDY: 'AI / Tech',
  W: 'AI / Tech', DT: 'AI / Tech', APPF: 'AI / Tech', U: 'AI / Tech',
  VEEV: 'AI / Tech', CYBR: 'AI / Tech', HUBS: 'AI / Tech',
  TEAM: 'AI / Tech', ZM: 'AI / Tech', DOCU: 'AI / Tech',
  OKTA: 'AI / Tech', NET: 'AI / Tech', ZS: 'AI / Tech',
  // ── AI / Chips ────────────────────────────────────────────────────────────
  NVDA: 'AI / Chips', AMD: 'AI / Chips', INTC: 'AI / Chips', QCOM: 'AI / Chips',
  AMAT: 'AI / Chips', LRCX: 'AI / Chips', KLAC: 'AI / Chips', ASML: 'AI / Chips',
  MU: 'AI / Chips', WDC: 'AI / Chips', STX: 'AI / Chips', NXPI: 'AI / Chips',
  TSM: 'AI / Chips', AVGO: 'AI / Chips',
  ADI: 'AI / Chips', MRVL: 'AI / Chips', MCHP: 'AI / Chips',
  MPWR: 'AI / Chips', ON: 'AI / Chips', QRVO: 'AI / Chips', SWKS: 'AI / Chips',
  TXN: 'AI / Chips', AMKR: 'AI / Chips', AEIS: 'AI / Chips', COHU: 'AI / Chips',
  // ── Defense ───────────────────────────────────────────────────────────────
  PLTR: 'Defense', BA: 'Defense', RTX: 'Defense', LMT: 'Defense',
  NOC: 'Defense', GD: 'Defense', LHX: 'Defense', TDY: 'Defense',
  HII: 'Defense', LDOS: 'Defense', SAIC: 'Defense', CACI: 'Defense',
  LM: 'Defense',
  // ── Aerospace ─────────────────────────────────────────────────────────────
  ULCC: 'Aerospace', DAL: 'Aerospace', LUV: 'Aerospace', AAL: 'Aerospace',
  UAL: 'Aerospace', ALK: 'Aerospace', SKYW: 'Aerospace', MESA: 'Aerospace',
  TDG: 'Aerospace', HON: 'Aerospace',
  SWA: 'Aerospace', SAVE: 'Aerospace', AER: 'Aerospace', VTOL: 'Aerospace',
  // ── Oil & Gas ──────────────────────────────────────────────────────────────
  XOM: 'Oil & Gas', CVX: 'Oil & Gas', COP: 'Oil & Gas', EOG: 'Oil & Gas',
  SLB: 'Oil & Gas', HAL: 'Oil & Gas', DVN: 'Oil & Gas', OXY: 'Oil & Gas',
  PXD: 'Oil & Gas', MRO: 'Oil & Gas', FANG: 'Oil & Gas', CTRA: 'Oil & Gas',
  ET: 'Oil & Gas', ENB: 'Oil & Gas', BP: 'Oil & Gas',
  OVV: 'Oil & Gas', VTLE: 'Oil & Gas', ESTE: 'Oil & Gas',
  MIN: 'Oil & Gas', CRK: 'Oil & Gas', EPD: 'Oil & Gas',
  CEQP: 'Oil & Gas', OKE: 'Oil & Gas', KMI: 'Oil & Gas',
  WMB: 'Oil & Gas', ETP: 'Oil & Gas',
  // ── Renewable Energy ───────────────────────────────────────────────────────
  ENPH: 'Renewable Energy', RUN: 'Renewable Energy', SOLV: 'Renewable Energy',
  NEE: 'Renewable Energy', ED: 'Renewable Energy', AEP: 'Renewable Energy',
  DUK: 'Renewable Energy', SO: 'Renewable Energy', D: 'Renewable Energy',
  EXC: 'Renewable Energy', CEG: 'Renewable Energy',
  // ── Finance ───────────────────────────────────────────────────────────────
  GS: 'Finance', MS: 'Finance', JPM: 'Finance', BAC: 'Finance',
  WFC: 'Finance', C: 'Finance', USB: 'Finance', PNC: 'Finance',
  TFC: 'Finance', COF: 'Finance', AXP: 'Finance',
  SCHW: 'Finance', TROW: 'Finance', IVZ: 'Finance',
  APO: 'Finance', CG: 'Finance', BLK: 'Finance', VOYG: 'Finance',
  FULT: 'Finance', SYF: 'Finance', ALLY: 'Finance',
  CFG: 'Finance', STT: 'Finance', IBOC: 'Finance',
  FCNCA: 'Finance', MORN: 'Finance', LAZ: 'Finance',
  KEY: '***', EG: 'Finance', PFG: 'Finance',
  // ── Financial Services ────────────────────────────────────────────────────
  FSV: 'Financial Services', NDAQ: 'Financial Services',
  LPLA: 'Financial Services', FDS: 'Financial Services',
  MKTX: 'Financial Services', IT: 'Financial Services', VIRT: 'Financial Services',
  MIAX: 'Financial Services',
  // ── AdTech / Data ─────────────────────────────────────────────────────────
  TTD: 'AdTech / Data', SGI: 'AdTech / Data',
  FLEX: 'AdTech / Data', VLTO: 'AdTech / Data',
  WAT: 'AdTech / Data', TER: 'AdTech / Data',
  COHR: 'AdTech / Data', TECH: 'AdTech / Data',
  // ── Specialty Chemicals ───────────────────────────────────────────────────
  GIL: 'Specialty Chemicals', SSNC: 'Specialty Chemicals',
  CHRW: 'Specialty Chemicals', EMN: 'Specialty Chemicals',
  APD: 'Specialty Chemicals', EC: 'Specialty Chemicals',
  CE: 'Specialty Chemicals', PPG: 'Specialty Chemicals',
  LIN: 'Specialty Chemicals', RPM: 'Specialty Chemicals',
  ECL: 'Specialty Chemicals', SW: 'Specialty Chemicals',
  // ── Building Materials ─────────────────────────────────────────────────────
  IBP: 'Building Materials', LGIH: 'Building Materials',
  MAS: 'Building Materials', DOOR: 'Building Materials',
  EXP: 'Building Materials', FBR: 'Building Materials',
  // ── Staffing & HR ──────────────────────────────────────────────────────────
  PAYX: 'Staffing & HR', PAYC: 'Staffing & HR',
  ADP: 'Staffing & HR', GPN: 'Staffing & HR',
  RHI: 'Staffing & HR', JOB: 'Staffing & HR', KFY: 'Staffing & HR',
  // ── Insurance ──────────────────────────────────────────────────────────────
  PGR: 'Insurance', BRO: 'Insurance', PRU: 'Insurance',
  AFL: 'Insurance', MET: 'Insurance', TRV: 'Insurance',
  Erie: 'Insurance', CB: 'Insurance', MKL: 'Insurance',
  ENBP: 'Insurance',
  // ── Food & Agriculture ─────────────────────────────────────────────────────
  CAG: 'Food & Agriculture', KR: 'Food & Agriculture',
  TSN: 'Food & Agriculture', HSY: 'Food & Agriculture',
  KMB: 'Food & Agriculture', GIS: 'Food & Agriculture',
  K: 'Food & Agriculture', KHC: 'Food & Agriculture',
  ADM: 'Food & Agriculture',
  // ── Infrastructure & Engineering ───────────────────────────────────────────
  EME: 'Infrastructure & Engineering', FSS: 'Infrastructure & Engineering',
  PWR: 'Infrastructure & Engineering', EFX: 'Infrastructure & Engineering',
  URI: 'Infrastructure & Engineering', VRSK: 'Infrastructure & Engineering',
  FE: 'Infrastructure & Engineering',
  // ── Biotech / Pharma ──────────────────────────────────────────────────────
  MRNA: 'Biotech', BIIB: 'Biotech', REGN: 'Biotech', VRTX: 'Biotech',
  GILD: 'Biotech', BMRN: 'Biotech', CRSP: 'Biotech', INT: 'Biotech',
  PFE: 'Pharma', JNJ: 'Pharma', LLY: 'Pharma', ABBV: 'Pharma',
  MRK: 'Pharma', BMY: 'Pharma', AMGN: 'Pharma',
  TMO: 'Biotech', PKG: 'Biotech', STE: 'Biotech', BBIO: 'Biotech',
  ABT: 'Biotech', ISRG: 'Biotech',
  ZTS: 'Biotech', IDXX: 'Biotech',
  RVTY: 'Biotech', BEAM: 'Biotech', ARNA: 'Biotech', ALXN: 'Biotech',
  NKTR: 'Biotech', SAGE: 'Biotech', PCRX: 'Biotech',
  MYNZ: 'Biotech', ARKG: 'Biotech', XBI: 'Biotech', IBB: 'Biotech',
  // ── Medical Devices ────────────────────────────────────────────────────────
  PODD: 'Medical Devices', DXCM: 'Medical Devices',
  HOLX: 'Medical Devices',
  // ── Healthcare ─────────────────────────────────────────────────────────────
  UNH: 'Healthcare', HUM: 'Healthcare', CI: 'Healthcare',
  MCK: 'Healthcare', ABC: 'Healthcare',
  GEHC: 'Healthcare', COR: 'Healthcare', ACHC: 'Healthcare',
  UHS: 'Healthcare', THC: 'Healthcare', HCA: 'Healthcare',
  CYH: 'Healthcare', UEC: 'Healthcare', EHC: 'Healthcare',
  BHC: 'Healthcare', HSTM: 'Healthcare',
  // ── Media ─────────────────────────────────────────────────────────────────
  DIS: 'Media', WBD: 'Media', PARA: 'Media',
  CMCSA: 'Media', CHTR: 'Media', NFLX: 'Media',
  NWS: 'Media', FOX: 'Media', LEE: 'Media', PSKY: 'Media',
  IPG: 'Media',
  // ── Telecom ──────────────────────────────────────────────────────────────
  VZ: 'Telecom', T: 'Telecom', CCI: 'Telecom', EQIX: 'Telecom',
  TMUS: 'Telecom', LITE: 'Telecom',
  // ── Real Estate ────────────────────────────────────────────────────────────
  PLD: 'Real Estate', SPG: 'Real Estate', O: 'Real Estate',
  WELL: 'Real Estate', ARE: 'Real Estate', AMT: 'Real Estate',
  EQR: 'Real Estate', VTR: 'Real Estate', VICI: 'Real Estate',
  AVB: 'Real Estate', AIV: 'Real Estate', BRX: 'Real Estate',
  CLI: 'Real Estate', KRC: 'Real Estate', BXP: 'Real Estate',
  FRT: 'Real Estate', SBRA: 'Real Estate', CHCT: 'Real Estate',
  DOC: 'Real Estate', GMRE: 'Real Estate', OPI: 'Real Estate',
  AHR: 'Real Estate', CUZ: 'Real Estate',
  // ── Consumer ───────────────────────────────────────────────────────────────
  WMT: 'Consumer', TGT: 'Consumer', COST: 'Consumer', HD: 'Consumer',
  LOW: 'Consumer', KO: 'Consumer', PEP: 'Consumer', PG: 'Consumer',
  MDLZ: 'Consumer', DG: 'Consumer', DLTR: 'Consumer', OMC: 'Consumer',
  NKE: 'Consumer', TSCO: 'Consumer', PFGC: 'Consumer', DRI: 'Consumer',
  SHW: 'Consumer', NVR: 'Consumer',
  MAR: 'Consumer', H: 'Consumer',
  KVUE: 'Consumer', ORLY: 'Consumer', LULU: 'Consumer',
  CVNA: 'Consumer', CBRL: 'Consumer', HOG: 'Consumer',
  PHM: 'Consumer', KBH: 'Consumer', DHI: 'Consumer', LEN: 'Consumer',
  MTH: 'Consumer', TMHC: 'Consumer', TOL: 'Consumer',
  SBH: 'Consumer', TAP: 'Consumer', SARO: 'Consumer',
  BIRK: 'Consumer', JBX: 'Consumer', CRESY: 'Consumer',
  NLS: 'Consumer', BC: 'Consumer', GNRC: 'Consumer',
  BGS: 'Consumer', JJSF: 'Consumer', LNCE: 'Consumer',
  // ── Automotive ─────────────────────────────────────────────────────────────
  TSLA: 'Automotive', RIVN: 'Automotive', F: 'Automotive', GM: 'Automotive',
  TM: 'Automotive', HYZN: 'Automotive', LCID: 'Automotive', NKLA: 'Automotive',
  SMP: 'Automotive',
  // ── Industrials ────────────────────────────────────────────────────────────
  CAT: 'Industrials', DE: 'Industrials',
  GE: 'Industrials', UPS: 'Industrials', FDX: 'Industrials', ETN: 'Industrials',
  CARR: 'Industrials', PH: 'Industrials', AME: 'Industrials',
  FISV: 'Industrials', ROP: 'Industrials', ITW: 'Industrials',
  CMI: 'Industrials', GWW: 'Industrials',
  GLW: 'Industrials', CLH: 'Industrials', IP: 'Industrials',
  TEL: 'Industrials', WAB: 'Industrials', ITT: 'Industrials', ROK: 'Industrials',
  APH: 'Industrials', WCC: 'Industrials', GPC: 'Industrials',
  AZZ: 'Industrials', B: 'Industrials',
  RS: 'Industrials', MRC: 'Industrials', PCH: 'Industrials',
  HLNE: 'Industrials', BXC: 'Industrials',
  HNI: 'Industrials', TILE: 'Industrials', SCS: 'Industrials',
  GEF: 'Industrials', ODFL: 'Industrials',
  J: 'Industrials', VIK: 'Industrials', UHALB: 'Industrials',
  CDRE: 'Industrials', DIOD: 'Industrials', MTSX: 'Industrials',
  ESNT: 'Industrials', AXON: 'Industrials', DCI: 'Industrials', FCN: 'Industrials',
  HCI: 'Industrials',
  // ── Cybersecurity ──────────────────────────────────────────────────────────
  PANW: 'Cybersecurity', FTNT: 'Cybersecurity', CRWD: 'Cybersecurity',
  // ── Payment Processing ─────────────────────────────────────────────────────
  PYPL: 'Payment Processing', FIS: 'Payment Processing', WEX: 'Payment Processing',
  V: 'Payment Processing', MA: 'Payment Processing', EVLV: 'Payment Processing',
  // ── Crypto ─────────────────────────────────────────────────────────────────
  COIN: 'Crypto', MSTR: 'Crypto', GBTC: 'Crypto', ETHE: 'Crypto',
  // ── ETFs / Index ──────────────────────────────────────────────────────────
  SPY: 'ETFs', QQQ: 'ETFs', VTI: 'ETFs', IWM: 'ETFs',
  VOO: 'ETFs', VEA: 'ETFs', VWO: 'ETFs', EFA: 'ETFs',
  AGG: 'ETFs', TLT: 'ETFs', GLD: 'ETFs', SLV: 'ETFs',
  IAU: 'ETFs', EEM: 'ETFs', ACWI: 'ETFs', URTH: 'ETFs',
  FAM: 'ETFs',
  // ── Restaurants & Hospitality ───────────────────────────────────────────────
  DPZ: 'Restaurants & Hospitality',
  // ── Logistics & Delivery ────────────────────────────────────────────────────
  DASH: 'Logistics & Delivery', RSG: 'Logistics & Delivery',
  // ── Packaging & Containers ──────────────────────────────────────────────────
  BALL: 'Packaging & Containers',
  // ── Environmental Services ─────────────────────────────────────────────────
  WM: 'Environmental Services',
  // ── Business Services ───────────────────────────────────────────────────────
  ROL: 'Business Services', ST: 'Business Services',
  FN: 'Business Services', AVT: 'Business Services',
  // ── Consumer Internet ───────────────────────────────────────────────────────
  ABNB: 'Consumer Internet', SE: 'Consumer Internet',
  YELP: 'Consumer Internet', GRPN: 'Consumer Internet',
  OLO: 'Consumer Internet', DUOL: 'Consumer Internet',
  MELI: 'Consumer Internet',
  // ── Construction Materials ───────────────────────────────────────────────────
  MLM: 'Construction Materials',
  // ── Investment Holdings ─────────────────────────────────────────────────────
  BRK_B: 'Investment Holdings', BR: 'Investment Holdings',
  IEP: 'Investment Holdings',
  // ── Energy ─────────────────────────────────────────────────────────────────
  VNOM: 'Energy', WFR: 'Energy', GAS: 'Energy',
  RNGR: 'Energy', PR: 'Energy',
  // ── Additional Mapped ───────────────────────────────────────────────────────
  VRSN: 'AI / Tech', SNDK: 'AI / Tech',
  INTA: 'AI / Tech', ZI: 'AI / Tech',
  MBLY: 'AI / Tech', CPTN: 'AI / Tech',
  MNR: 'Real Estate', JLL: 'Real Estate',
  INX: 'Finance', AmAT: 'Finance', AEG: 'Finance',
  ZNJA: 'Finance', NTFG: 'Finance',
};

export function getSector(ticker: string, companyName?: string): string {
  if (TICKER_SECTORS[ticker]) return TICKER_SECTORS[ticker];
  if (!companyName) return 'Catch-All / Misc';
  const n = companyName.toUpperCase();
  if (/INSURANCE|SURETY|REINSURANCE|UNDERWRITING/.test(n)) return 'Insurance';
  if (/HOLDINGS|PARTNERS|INVESTMENT|ASSET MANAGEMENT|VENTURE CAPITAL/.test(n)) return 'Investment Holdings';
  if (/PETROLEUM|OIL & GAS|ENERGY INC|EXXON|SHELL|BP |CHEVRON/.test(n)) return 'Oil & Gas';
  if (/BIOTECH|THERAPEUTICS|GENOMICS|PHARMACEUTICALS/.test(n)) return 'Biotech';
  if (/AEROSPACE|AVIATION|DEFENSE CONTRACTOR/.test(n)) return 'Aerospace';
  if (/TELECOM|COMMUNICATIONS|WIRELESS/.test(n)) return 'Telecom';
  if (/RAIL|TRANSPORT|LOGISTICS|FREIGHT/.test(n)) return 'Industrials';
  if (/HOSPITAL|MEDICAL DEVICES|HEALTHCARE|CLINIC/.test(n)) return 'Healthcare';
  if (/BANK|MORTGAGE|CREDIT|FINANCIAL/.test(n)) return 'Finance';
  if (/TECHNOLOGY|SOFTWARE|DIGITAL|CLOUD|SEMICONDUCTOR/.test(n)) return 'AI / Tech';
  if (/REIT|REAL ESTATE|PROPERTY/.test(n)) return 'Real Estate';
  if (/FOOD|DISTRIBUTION|AGRICULTURE|COMMODITY/.test(n)) return 'Food & Agriculture';
  if (/MEDIA|ENTERTAINMENT|BROADCASTING|PUBLISHING/.test(n)) return 'Media';
  if (/CHEMICALS|MATERIALS|POLYMER/.test(n)) return 'Specialty Chemicals';
  if (/CONSTRUCTION|INFRASTRUCTURE|ENGINEERING/.test(n)) return 'Infrastructure & Engineering';
  if (/EXCHANGE|TRADING|BROKERAGE/.test(n)) return 'Financial Services';
  if (/RETAIL|STORE|DISCOUNT|GROCERY/.test(n)) return 'Consumer';
  if (/ETHEREUM|BITCOIN|CRYPTO|VIRTUAL CURRENCY/.test(n)) return 'Crypto';
  return 'Catch-All / Misc';
}
