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
  'Healthcare': '#f43f5e',
  'Transportation': '#0ea5e9',
  'Utilities': '#4ade80',
  'Metals & Mining': '#a8a29e',
};

export const TICKER_SECTORS: Record<string, string> = {
  // ── AI / Tech ──────────────────────────────────────────────────────────────
  MSFT: 'AI / Tech', GOOGL: 'AI / Tech', GOOG: 'AI / Tech', META: 'AI / Tech',
  AMZN: 'Consumer', AAPL: 'AI / Tech', CRM: 'AI / Tech',
  ORCL: 'AI / Tech', IBM: 'AI / Tech', ADBE: 'AI / Tech', SNOW: 'AI / Tech',
  UBER: 'AI / Tech', SHOP: 'AI / Tech', SQ: 'AI / Tech', SPOT: 'Media',
  SNAP: 'AI / Tech', PIN: 'AI / Tech', MTCH: 'AI / Tech',
  NOW: 'AI / Tech', WDAY: 'AI / Tech', APP: 'AI / Tech', DDOG: 'AI / Tech',
  HOOD: 'Finance', EPAM: 'AI / Tech', CTSH: 'AI / Tech', ACN: 'AI / Tech',
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
  TXN: 'AI / Chips', AMKR: 'AI / Chips', AEIS: 'Industrials', COHU: 'AI / Chips',
  // ── Defense ───────────────────────────────────────────────────────────────
  PLTR: 'AI / Tech', BA: 'Defense', RTX: 'Defense', LMT: 'Defense',
  NOC: 'Defense', GD: 'Defense', LHX: 'Defense', TDY: 'Defense',
  HII: 'Defense', LDOS: 'Defense', SAIC: 'Defense', CACI: 'Defense',
  LM: 'Defense',
  // ── Aerospace ─────────────────────────────────────────────────────────────
  ULCC: 'Aerospace', DAL: 'Transportation', LUV: 'Transportation', AAL: 'Transportation',
  UAL: 'Transportation', ALK: 'Transportation', SKYW: 'Aerospace', MESA: 'Aerospace',
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
  ENPH: 'Renewable Energy', RUN: 'Renewable Energy', SOLV: 'Medical Devices',
  NEE: 'Utilities', ED: 'Utilities', AEP: 'Utilities',
  DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  EXC: 'Utilities', CEG: 'Utilities',
  // ── Finance ───────────────────────────────────────────────────────────────
  GS: 'Finance', MS: 'Finance', JPM: 'Finance', BAC: 'Finance',
  WFC: 'Finance', C: 'Finance', USB: 'Finance', PNC: 'Finance',
  TFC: 'Finance', COF: 'Finance', AXP: 'Finance',
  SCHW: 'Finance', TROW: 'Finance', IVZ: 'Finance',
  APO: 'Finance', CG: 'Finance', BLK: 'Finance', VOYG: 'Defense',
  FULT: 'Finance', SYF: 'Finance', ALLY: 'Finance',
  CFG: 'Finance', STT: 'Finance', IBOC: 'Finance',
  FCNCA: 'Finance', MORN: 'Finance', LAZ: 'Finance',
  KEY: 'Finance', EG: 'Insurance', PFG: 'Insurance',
  // ── Financial Services ────────────────────────────────────────────────────
  FSV: 'Real Estate', NDAQ: 'Financial Services',
  LPLA: 'Financial Services', FDS: 'Financial Services',
  MKTX: 'Financial Services', IT: 'Financial Services', VIRT: 'Financial Services',
  MIAX: 'Financial Services',
  // ── AdTech / Data ─────────────────────────────────────────────────────────
  TTD: 'AdTech / Data', SGI: 'Consumer',
  FLEX: 'Industrials', VLTO: 'AdTech / Data',
  COHR: 'AdTech / Data', TECH: 'Biotech',
  // ── Specialty Chemicals ───────────────────────────────────────────────────
  GIL: 'Specialty Chemicals', SSNC: 'AI / Tech',
  CHRW: 'Transportation', EMN: 'Specialty Chemicals',
  APD: 'Specialty Chemicals', EC: 'Oil & Gas',
  CE: 'Specialty Chemicals', PPG: 'Specialty Chemicals',
  LIN: 'Specialty Chemicals', RPM: 'Specialty Chemicals',
  ECL: 'Specialty Chemicals', SW: 'Packaging & Containers',
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
  ENBP: 'Finance',
  // ── Food & Agriculture ─────────────────────────────────────────────────────
  CAG: 'Food & Agriculture', KR: 'Food & Agriculture',
  TSN: 'Food & Agriculture', HSY: 'Food & Agriculture',
  GIS: 'Food & Agriculture',
  K: 'Food & Agriculture', KHC: 'Food & Agriculture',
  ADM: 'Food & Agriculture',
  // ── Infrastructure & Engineering ───────────────────────────────────────────
  EME: 'Infrastructure & Engineering', FSS: 'Automotive',
  PWR: 'Infrastructure & Engineering', EFX: 'Financial Services',
  URI: 'Infrastructure & Engineering', VRSK: 'AI / Tech',
  FE: 'Utilities',
  // ── Biotech / Pharma ──────────────────────────────────────────────────────
  MRNA: 'Biotech', BIIB: 'Biotech', REGN: 'Biotech', VRTX: 'Biotech',
  GILD: 'Biotech', BMRN: 'Biotech', CRSP: 'Biotech', INT: 'Biotech',
  PFE: 'Pharma', JNJ: 'Pharma', LLY: 'Pharma', ABBV: 'Pharma',
  MRK: 'Pharma', BMY: 'Pharma', AMGN: 'Pharma',
  TMO: 'Biotech', PKG: 'Packaging & Containers', STE: 'Medical Devices', BBIO: 'Biotech',
  ABT: 'Healthcare', ISRG: 'Medical Devices',
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
  VZ: 'Telecom', T: 'Telecom', CCI: 'Real Estate', EQIX: 'Real Estate',
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
  SBH: 'Consumer', TAP: 'Consumer', SARO: 'Aerospace',
  BIRK: 'Consumer', JBX: 'Consumer', CRESY: 'Consumer',
  NLS: 'Consumer', BC: 'Industrials', GNRC: 'Consumer',
  BGS: 'Consumer', JJSF: 'Consumer', LNCE: 'Consumer',
  // ── Automotive ─────────────────────────────────────────────────────────────
  TSLA: 'Automotive', RIVN: 'Automotive', F: 'Automotive', GM: 'Automotive',
  TM: 'Automotive', HYZN: 'Automotive', LCID: 'Automotive', NKLA: 'Automotive',
  SMP: 'Automotive',
  // ── Industrials ────────────────────────────────────────────────────────────
  CAT: 'Industrials', DE: 'Industrials',
  GE: 'Industrials', UPS: 'Transportation', FDX: 'Transportation', ETN: 'Industrials',
  CARR: 'Industrials', PH: 'Industrials', AME: 'Industrials',
  FISV: 'Industrials', ROP: 'Industrials', ITW: 'Industrials',
  CMI: 'Industrials', GWW: 'Industrials',
  GLW: 'Industrials', CLH: 'Environmental Services', IP: 'Industrials',
  TEL: 'Industrials', WAB: 'Industrials', ITT: 'Industrials', ROK: 'Industrials',
  APH: 'Industrials', WCC: 'Industrials', GPC: 'Industrials',
  AZZ: 'Industrials', B: 'Industrials',
  RS: 'Industrials', MRC: 'Industrials', PCH: 'Industrials',
  HLNE: 'Industrials', BXC: 'Industrials',
  HNI: 'Industrials', TILE: 'Industrials', SCS: 'Industrials',
  GEF: 'Industrials', ODFL: 'Transportation',
  J: 'Industrials', VIK: 'Transportation', UHALB: 'Industrials',
  CDRE: 'Industrials', DIOD: 'Industrials', MTSX: 'Industrials',
  ESNT: 'Insurance', AXON: 'Industrials', DCI: 'Industrials', FCN: 'Industrials',
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
  DASH: 'Logistics & Delivery', RSG: 'Environmental Services',
  // ── Packaging & Containers ──────────────────────────────────────────────────
  BALL: 'Packaging & Containers',
  // ── Environmental Services ─────────────────────────────────────────────────
  WM: 'Environmental Services',
  // ── Business Services ───────────────────────────────────────────────────────
  ROL: 'Business Services', ST: 'Business Services',
  FN: 'Telecom', AVT: 'Business Services',
  // ── Consumer Internet ───────────────────────────────────────────────────────
  ABNB: 'Consumer Internet', SE: 'Consumer Internet',
  YELP: 'Consumer Internet', GRPN: 'Consumer Internet',
  OLO: 'Consumer Internet', DUOL: 'AI / Tech',
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
  INX: 'Finance', AEG: 'Finance',
  ZNJA: 'Finance', NTFG: 'Finance',
  // -- SEC SIC-sourced additions (2026-10-21): label from the issuer's EDGAR SIC code --
  BSX: 'Medical Devices', ANET: 'AI / Tech', SBUX: 'Restaurants & Hospitality', MCD: 'Restaurants & Hospitality',
  UNP: 'Transportation', CSCO: 'AI / Tech', CMG: 'Restaurants & Hospitality', BX: 'Finance', SYK: 'Medical Devices',
  NVO: 'Pharma', DELL: 'AI / Tech', MMM: 'Medical Devices', HUBB: 'Industrials', PTC: 'AI / Tech', SAP: 'AI / Tech',
  WRB: 'Insurance', LH: 'Healthcare', CNC: 'Healthcare', BJ: 'Consumer', MDT: 'Medical Devices',
  CSX: 'Transportation', TJX: 'Consumer', ELV: 'Healthcare', SMCI: 'AI / Tech', MIDD: 'Industrials',
  NSC: 'Transportation', KKR: 'Finance', HY: 'Industrials', CVS: 'Consumer', SNPS: 'AI / Tech', FWONK: 'Media',
  AZN: 'Pharma', SPGI: 'Financial Services', GEV: 'Industrials', CL: 'Consumer', BHP: 'Metals & Mining',
  EMR: 'Industrials', CRDO: 'AI / Chips', DEO: 'Consumer', NVS: 'Pharma', LTH: 'Consumer', VRT: 'Industrials',
  HDB: 'Finance', BWXT: 'Industrials', MPC: 'Oil & Gas', GSK: 'Pharma', CDNS: 'AI / Tech', CME: 'Financial Services',
  STZ: 'Consumer', AJG: 'Insurance', FCX: 'Metals & Mining', PM: 'Consumer', CDW: 'Consumer', AZO: 'Consumer',
  MNST: 'Consumer', ARLP: 'Energy', SRE: 'Utilities', CHD: 'Consumer', DOX: 'AI / Tech', VST: 'Utilities',
  LYV: 'Media', MTZ: 'Infrastructure & Engineering', ICE: 'Financial Services', FLL: 'Restaurants & Hospitality',
  SJM: 'Food & Agriculture', MKC: 'Food & Agriculture', UL: 'Consumer', SHEL: 'Oil & Gas', TTWO: 'AI / Tech',
  NTES: 'AI / Tech', ADSK: 'AI / Tech', MTSI: 'AI / Chips', SBAC: 'Real Estate', WY: 'Real Estate',
  EPAC: 'Industrials', BE: 'Industrials', STRL: 'Infrastructure & Engineering', CBOE: 'Financial Services',
  CCL: 'Transportation', IR: 'Industrials', TXRH: 'Restaurants & Hospitality', WYNN: 'Restaurants & Hospitality',
  SFM: 'Consumer', MGY: 'Oil & Gas', RIO: 'Metals & Mining', VLO: 'Oil & Gas', AOS: 'Consumer', CIEN: 'Telecom',
  FMAO: 'Finance', CP: 'Transportation', BDX: 'Medical Devices', SF: 'Finance', DGX: 'Healthcare', AWK: 'Utilities',
  NGL: 'Oil & Gas', BAX: 'Medical Devices', NEM: 'Metals & Mining', MOH: 'Healthcare', MRSH: 'Insurance',
  CPB: 'Food & Agriculture', KDP: 'Consumer', ROST: 'Consumer', FITB: 'Finance', TW: 'Financial Services',
  OTIS: 'Industrials', SMTC: 'AI / Chips', WTW: 'Insurance', TYL: 'AI / Tech', MSI: 'Telecom', HPE: 'AI / Tech',
  LYB: 'Specialty Chemicals', RLI: 'Insurance', EW: 'Medical Devices', RGEN: 'Biotech', NWG: 'Finance',
  JCI: 'Industrials', GMED: 'Medical Devices', YUM: 'Restaurants & Hospitality', EL: 'Consumer', ADC: 'Real Estate',
  CVLT: 'AI / Tech', WPM: 'Metals & Mining', SNDR: 'Transportation', PCVX: 'Biotech',
  PRIM: 'Infrastructure & Engineering', EXE: 'Oil & Gas', AMP: 'Finance', RBLX: 'AI / Tech', HOMB: 'Finance',
  IFNNY: 'AI / Chips', CHRD: 'Oil & Gas', AIG: 'Insurance', BCS: 'Finance', HLT: 'Restaurants & Hospitality',
  INSM: 'Pharma', ARES: 'Finance', CAH: 'Healthcare', NOK: 'Telecom', APTV: 'Automotive', TRGP: 'Oil & Gas',
  WST: 'Medical Devices', CMS: 'Utilities', PEG: 'Utilities', IRM: 'Real Estate', UNM: 'Insurance',
  IEX: 'Industrials', MCO: 'Financial Services', NCLH: 'Transportation', PINS: 'AI / Tech', PRMB: 'Consumer',
  NTRS: 'Finance', RCL: 'Transportation', TWLO: 'AI / Tech', L: 'Insurance', IRT: 'Real Estate', EIX: 'Utilities',
  HMN: 'Insurance', HLN: 'Consumer', ARMK: 'Restaurants & Hospitality', GTY: 'Real Estate', XYZ: 'AI / Tech',
  KRG: 'Real Estate', SBCF: 'Finance', ING: 'Finance', AGIO: 'Pharma', HSBC: 'Finance', ALGN: 'Medical Devices',
  LAMR: 'Real Estate', RF: 'Finance', STAG: 'Real Estate', PSA: 'Real Estate', BWIN: 'Insurance', RACE: 'Automotive',
  TNDM: 'Medical Devices', RHP: 'Real Estate', CYTK: 'Pharma', SNY: 'Pharma', GWRE: 'AI / Tech', IBKR: 'Finance',
  VIAV: 'AI / Chips', ACI: 'Consumer', BEP: 'Utilities', HLI: 'Finance', VALE: 'Metals & Mining', RARE: 'Pharma',
  HMC: 'Automotive', DECK: 'Consumer', WTRG: 'Utilities', DLR: 'Real Estate', AMH: 'Real Estate', AVAV: 'Aerospace',
  INFY: 'AI / Tech', PAR: 'AI / Tech', BTI: 'Consumer', TLK: 'Telecom', AEE: 'Utilities', EQT: 'Oil & Gas',
  DBX: 'AI / Tech', IREN: 'Finance', HRL: 'Food & Agriculture', COCO: 'Consumer', WEC: 'Utilities',
  SMPL: 'Food & Agriculture', PCAR: 'Automotive', NICE: 'AI / Tech', SKWD: 'Insurance', LGND: 'Pharma',
  CCJ: 'Metals & Mining', ACIW: 'AI / Tech', CNH: 'Industrials', FIX: 'Infrastructure & Engineering',
  FIVE: 'Consumer', ELF: 'Consumer', PI: 'Industrials', FWRG: 'Restaurants & Hospitality', TTE: 'Oil & Gas',
  PATK: 'Automotive', MUFG: 'Finance', PSX: 'Oil & Gas', EXR: 'Real Estate', GNPX: 'Pharma', MNDY: 'AI / Tech',
  SUPN: 'Pharma', BCO: 'Transportation', INGR: 'Food & Agriculture', SIRI: 'Media', BL: 'AI / Tech',
  MBFJF: 'Finance', RDDT: 'AI / Tech', BEN: 'Finance', FLO: 'Food & Agriculture', ES: 'Utilities', CRWV: 'AI / Tech',
  ARM: 'AI / Chips', NGG: 'Oil & Gas', MDB: 'AI / Tech', FFIV: 'AI / Tech', ABEV: 'Consumer', RPD: 'AI / Tech',
  RMD: 'Medical Devices', PCG: 'Utilities', WHR: 'Consumer', SAN: 'Finance', ATRC: 'Medical Devices',
  DVA: 'Healthcare', BURL: 'Consumer', NTRA: 'Healthcare', UTHR: 'Pharma', UE: 'Real Estate', AZTA: 'AI / Chips',
  WSFS: 'Finance', GLAS: 'Pharma', ROIV: 'Pharma', AON: 'Insurance', UDR: 'Real Estate', GTES: 'Industrials',
  BF_B: 'Consumer', QLYS: 'AI / Tech', DKS: 'Consumer', CHKP: 'AI / Tech', XEL: 'Utilities', PRGS: 'AI / Tech',
  NU: 'Finance', ACGL: 'Insurance', ZBH: 'Medical Devices', FCPT: 'Real Estate', VCYT: 'Healthcare',
  IDA: 'Utilities', BUSE: 'Finance', EQNR: 'Oil & Gas', DSGX: 'AI / Tech', WBI: 'Oil & Gas', VTRS: 'Pharma',
  UBS: 'Finance', HEI_A: 'Aerospace', CNQ: 'Oil & Gas', FIG: 'AI / Tech', CCEP: 'Consumer', DTEGY: 'Telecom',
  ARQT: 'Pharma', HST: 'Real Estate', LW: 'Food & Agriculture', BCLYF: 'Finance', HALO: 'Biotech',
  MTX: 'Specialty Chemicals', SCCO: 'Metals & Mining', AORT: 'Medical Devices', GPK: 'Packaging & Containers',
  UTZ: 'Food & Agriculture', VSEC: 'Infrastructure & Engineering', TFX: 'Medical Devices', HIW: 'Real Estate',
  SPHR: 'Media', ELS: 'Real Estate', EFC: 'Real Estate', VSNT: 'Media', TEM: 'AI / Tech', COLB: 'Finance',
  AESI: 'Oil & Gas', ALL: 'Insurance', NWE: 'Utilities', RRC: 'Oil & Gas', DINO: 'Oil & Gas', WAL: 'Finance',
  Q: 'AI / Chips', ALKT: 'AI / Tech', AGCO: 'Industrials', CINF: 'Insurance', LVS: 'Restaurants & Hospitality',
  WCN: 'Environmental Services', IFF: 'Specialty Chemicals', TCBI: 'Finance', ABCB: 'Finance', PBA: 'Oil & Gas',
  GL: 'Insurance', OSK: 'Automotive', WSM: 'Consumer', DCO: 'Aerospace', SNN: 'Medical Devices', GPOR: 'Oil & Gas',
  WPC: 'Real Estate', MGA: 'Automotive', DB: 'Finance', ANGO: 'Medical Devices', OGE: 'Utilities',
  INVH: 'Real Estate', GLOB: 'AI / Tech', LLYVK: 'Media', CLS: 'Industrials', HIG: 'Insurance', LYG: 'Finance',
  GBCI: 'Finance', CNO: 'Insurance', LGN: 'Infrastructure & Engineering', FMX: 'Consumer', OPEN: 'Real Estate',
  LI: 'Automotive', GMAB: 'Pharma', BBAI: 'AI / Tech', HPQ: 'AI / Tech', BKE: 'Consumer', CATY: 'Finance',
  ARIS: 'Metals & Mining', FCFS: 'Consumer', HBAN: 'Finance', FBK: 'Finance', MTB: 'Finance', AR: 'Oil & Gas',
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
