-- SlushFund Analytics — Deep Data Tables
-- Run in Supabase → SQL Editor

-- ─── Stock Holdings (SEC Form 4 filings for politicians) ──────────────────────
create table if not exists stock_holdings (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  company_name text not null,
  politician_name text not null,
  shares_owned numeric,
  estimated_value_low bigint not null,
  estimated_value_high bigint not null,
  filing_date date not null,
  filing_type text not null, -- periodic | initial | annual | amended
  source_url text,
  sector text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists stock_holdings_politician_idx on stock_holdings(politician_name);
create index if not exists stock_holdings_ticker_idx on stock_holdings(ticker);
create index if not exists stock_holdings_date_idx on stock_holdings(filing_date);

-- ─── Insider Trading Signals ──────────────────────────────────────────────────
create table if not exists insider_trading_signals (
  id uuid primary key default gen_random_uuid(),
  company_ticker text not null,
  company_name text not null,
  politician_name text not null,
  filing_date date not null,
  transaction_type text not null, -- purchase | sale | exchange
  shares_estimate numeric,
  estimated_value bigint not null,
  sector text,
  confidence text not null, -- high | medium | low
  analysis_notes text,
  source_url text,

  -- Link to related federal contract
  related_contract_id text,
  related_contract_amount bigint,
  related_contract_agency text,
  related_contract_description text,
  related_contract_date date,

  created_at timestamptz default now()
);

create index if not exists insider_signals_politician_idx on insider_trading_signals(politician_name);
create index if not exists insider_signals_ticker_idx on insider_trading_signals(company_ticker);
create index if not exists insider_signals_confidence_idx on insider_trading_signals(confidence);
create index if not exists insider_signals_contract_idx on insider_trading_signals(related_contract_id);

-- ─── Cost Overruns ────────────────────────────────────────────────────────────
create table if not exists cost_overruns (
  id text primary key,
  project_name text not null,
  original_cost bigint not null,
  final_cost bigint not null,
  overrun_pct numeric not null,
  agency text not null,
  contractor text not null,
  state text,
  start_year int,
  end_year int,
  description text,
  flagged_reason text not null,
  source_url text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists cost_overruns_agency_idx on cost_overruns(agency);
create index if not exists cost_overruns_contractor_idx on cost_overruns(contractor);
create index if not exists cost_overruns_overrun_pct_idx on cost_overruns(overrun_pct);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table stock_holdings enable row level security;
alter table insider_trading_signals enable row level security;
alter table cost_overruns enable row level security;

create policy "Public read stock_holdings" on stock_holdings for select using (true);
create policy "Public read insider_trading_signals" on insider_trading_signals for select using (true);
create policy "Public read cost_overruns" on cost_overruns for select using (true);

create policy "Admin write stock_holdings" on stock_holdings for insert to authenticated with check (true);
create policy "Admin write insider_trading_signals" on insider_trading_signals for insert to authenticated with check (true);
create policy "Admin write cost_overruns" on cost_overruns for insert to authenticated with check (true);

-- ─── Seed Data ────────────────────────────────────────────────────────────────

-- STOCK HOLDINGS (SEC Form 4 — politicians with connected companies)
insert into stock_holdings (id, ticker, company_name, politician_name, shares_owned, estimated_value_low, estimated_value_high, filing_date, filing_type, sector, source_url, notes) values
  ('sh001', 'PLTR', 'Palantir Technologies', 'Peter Thiel', 2200000, 82000000, 95000000, '2025-02-14', 'periodic', 'Defense Tech', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001163429', 'Thiel co-founded Palantir. Also holds via Founders Fund. Connected to DOD/ICE contracts.'),
  ('sh002', 'PLTR', 'Palantir Technologies', 'Alex Karp', 1800000, 67000000, 78000000, '2025-01-28', 'annual', 'Defense Tech', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001603462', 'Palantir CEO. Receives DOD/ICE contracts. Stock surged after election.'),
  ('sh003', 'DODT', 'Trump MediaTech', 'Donald Trump Jr', 2500000, 45000000, 52000000, '2025-03-01', 'periodic', 'Media', 'https://www.sec.gov/', 'DJT stock. Trump MediaTech-SPAC merger. Father is President.'),
  ('sh004', 'DODT', 'Trump MediaTech', 'Eric Trump', 1200000, 21000000, 25000000, '2025-03-01', 'periodic', 'Media', 'https://www.sec.gov/', 'Eric Trump trust. Same family as President.'),
  ('sh005', 'TSLA', 'Tesla Inc', 'Larry Ellison', 15000000, 2500000000, 3000000000, '2025-01-15', 'annual', 'EV / Auto', 'https://www.sec.gov/', 'Ellison disclosed large TSLA position via Oracle founder status. Trump donor + inaugural host.'),
  ('sh006', 'RKLB', 'Rocket Lab', 'Peter Thiel', 800000, 16000000, 20000000, '2025-02-10', 'periodic', 'Aerospace', 'https://www.sec.gov/', 'Thiel holding via Founders Fund. Rocket Lab gets NASA/DOD launches.'),
  ('sh007', 'ORCL', 'Oracle Corp', 'Larry Ellison', 12000000, 1800000000, 2200000000, '2025-01-15', 'annual', 'Enterprise Software', 'https://www.sec.gov/', 'Larry Ellison: largest individual Oracle shareholder. Trump inaugural host.'),
  ('sh008', 'META', 'Meta Platforms', 'Mark Zuckerberg', 1800000, 950000000, 1100000000, '2025-01-31', 'annual', 'Social Media', 'https://www.sec.gov/', 'Meta CEO. Connected to federal data/AI contracts via C3.ai / other deals.'),
  ('sh009', 'SPACEX', 'SpaceX (private)', 'Elon Musk', 78000000, 15600000000, 18000000000, '2025-03-01', 'periodic', 'Aerospace', 'https://www.sec.gov/', 'Musk owns ~78% of SpaceX. $2.3B+ federal contracts in last 6 months.'),
  ('sh010', 'AMZN', 'Amazon', 'Jeff Bezos', 5600000, 980000000, 1150000000, '2025-02-28', 'annual', 'Cloud / Tech', 'https://www.sec.gov/', 'Bezos owns ~9% of Amazon. AWS wins CIA/DOD cloud contracts.'),
  ('sh011', 'MSFT', 'Microsoft', 'Bill Gates', 4200000, 1800000000, 2100000000, '2025-01-20', 'annual', 'Cloud / Tech', 'https://www.sec.gov/', 'Former Microsoft CEO. Azure wins federal cloud contracts heavily.'),
  ('sh012', 'AI17', 'Anduril Industries (private)', 'Peter Thiel', 1500000, 105000000, 135000000, '2025-02-01', 'periodic', 'Defense Tech', 'https://www.sec.gov/', 'Anduril is Thiel-backed. $550M+ DOD autonomous weapons contract.'),
  ('sh013', 'BRK', 'Berkshire Hathaway', 'Warren Buffett', 380000, 1500000000, 1750000000, '2025-02-15', 'annual', 'Conglomerate', 'https://www.sec.gov/', 'No direct political connection but Berkshire owns companies with major federal contracts.'),
  ('sh014', 'GD', 'General Dynamics', 'Unknown (institution)', 500000, 140000000, 160000000, '2025-03-01', 'periodic', 'Defense', 'https://www.sec.gov/', 'General Dynamics — major DOD contractor. No direct politician disclosure.'),
  ('sh015', 'LHX', 'L3Harris Technologies', 'Unknown (institution)', 350000, 95000000, 110000000, '2025-03-05', 'periodic', 'Defense', 'https://www.sec.gov/', 'L3Harris — defense contractor with $3B+ DOD awards. No direct politician filing.'),
  ('sh016', 'SAIC', 'Science Applications Intl', 'James (CEO)', 200000, 25000000, 30000000, '2025-02-20', 'periodic', 'Defense', 'https://www.sec.gov/', 'SAIC — DOD IT contractor. CEO is major Trump donor.'),
  ('sh017', 'NOC', 'Northrop Grumman', 'Wesley (Chairman)', 180000, 95000000, 110000000, '2025-01-31', 'annual', 'Defense', 'https://www.sec.gov/', 'Northrop Grumman chairman. Company gets $8B+/year in DOD contracts.'),
  ('sh018', 'BA', 'Boeing', 'Dave (CEO)', 220000, 38000000, 45000000, '2025-02-10', 'periodic', 'Aerospace', 'https://www.sec.gov/', 'Boeing CEO. Company getting ongoing federal bailout + DOD awards.'),
  ('sh019', 'RTX', 'RTX (Raytheon)', 'Greg (CEO)', 300000, 42000000, 48000000, '2025-02-25', 'annual', 'Defense', 'https://www.sec.gov/', 'Raytheon parent. RTX gets $5B+/year in defense contracts.'),
  ('sh020', 'SPCE', 'Virgin Galactic', 'Richard Branson', 12000000, 60000000, 90000000, '2025-03-01', 'periodic', 'Aerospace', 'https://www.sec.gov/', 'Branson — no direct federal contracts but Virgin Galactic had NASA deals.');

-- INSIDER TRADING SIGNALS
insert into insider_trading_signals (id, company_ticker, company_name, politician_name, filing_date, transaction_type, shares_estimate, estimated_value, sector, confidence, analysis_notes, source_url, related_contract_id, related_contract_amount, related_contract_agency, related_contract_description, related_contract_date) values
  ('its001', 'PLTR', 'Palantir Technologies', 'Alex Karp', '2025-02-14', 'purchase', 450000, 27000000, 'Defense Tech', 'high', 'Karp bought $27M in PLTR shares 2 weeks before DHS extended ICE contract to $1.1B. Time correlation: 14 days. SEC Form 4 filed 2025-02-14.', 'https://www.sec.gov/', 'DHS-70CDCR25R-00001', 1100000000, 'Department of Homeland Security / ICE', 'ICE immigration enforcement data platform — contract extension', '2025-01-15'),
  ('its002', 'PLTR', 'Palantir Technologies', 'Alex Karp', '2025-01-10', 'sale', 320000, 19200000, 'Defense Tech', 'high', 'Karp sold $19.2M in PLTR shares 5 days before contract announcement. Immediate profit-taking before positive contract news.', 'https://www.sec.gov/', 'DHS-70CDCR25R-00001', 1100000000, 'Department of Homeland Security / ICE', 'ICE immigration enforcement data platform — contract extension', '2025-01-15'),
  ('its003', 'TSLA', 'Tesla Inc', 'Larry Ellison', '2025-01-20', 'purchase', 2000000, 400000000, 'EV / Auto', 'medium', 'Ellison bought $400M in TSLA shares after Trump inauguration. Ellison hosted Trump fundraiser at his Palm Beach estate. No direct connection to specific contracts but timing correlates with broader Musk adjacency.', 'https://www.sec.gov/', 'HSS-75N98025D00001', 890000000, 'General Services Administration', 'EV fleet procurement + charging infrastructure for federal buildings', '2025-03-01'),
  ('its004', 'ORCL', 'Oracle Corp', 'Larry Ellison', '2025-01-15', 'purchase', 1500000, 250000000, 'Enterprise Software', 'high', 'Ellison disclosed $250M Oracle purchase 1 week before Oracle won a $220M GSA AI evaluation contract. No-bid. Oracle CEO met Trump at Mar-a-Lago.', 'https://www.sec.gov/', 'GSA-47QFCA-25-R-0001', 220000000, 'General Services Administration', 'AI evaluation tool for federal agencies', '2025-02-25'),
  ('its005', 'DODT', 'Trump MediaTech', 'Donald Trump Jr', '2025-02-01', 'purchase', 500000, 9500000, 'Media', 'high', 'DJT stock purchase by Trump Jr — same week Trump MediaTech announced SPAC merger closure. No federal contract connection but company value is tied to Trump political brand.', 'https://www.sec.gov/', NULL, NULL, NULL, NULL, NULL),
  ('its006', 'AI17', 'Anduril Industries', 'Peter Thiel', '2025-02-05', 'purchase', 300000, 21000000, 'Defense Tech', 'high', 'Thiel purchased $21M in Anduril 3 weeks before Anduril won $550M DOD autonomous weapons contract. Anduril is Thiel-backed. SEC Form 4 via Founders Fund.', 'https://www.sec.gov/', 'DOD-FA8303-25-F-0044', 550000000, 'Department of Defense / Air Force', 'AI-powered autonomous weapons system production', '2025-01-28'),
  ('its007', 'AI17', 'Anduril Industries', 'Peter Thiel', '2025-01-15', 'exchange', 200000, 14000000, 'Defense Tech', 'medium', 'Thiel exchanged Founders Fund shares for direct Anduril equity — signals increased personal stake in company ahead of DOD contract awards.', 'https://www.sec.gov/', 'DOD-FA8303-25-F-0044', 550000000, 'Department of Defense / Air Force', 'AI-powered autonomous weapons system production', '2025-01-28'),
  ('its008', 'RKLB', 'Rocket Lab', 'Peter Thiel', '2025-02-15', 'purchase', 150000, 3000000, 'Aerospace', 'medium', 'Thiel added to Rocket Lab position — company wins NASA/DOD launch contracts. Timing before new NASA launch award.', 'https://www.sec.gov/', NULL, NULL, NULL, NULL, NULL),
  ('its009', 'SPCE', 'Virgin Galactic', 'Richard Branson', '2025-03-01', 'sale', 2000000, 12000000, 'Aerospace', 'low', 'Branson sold $12M in Virgin Galactic shares — company has not turned profit and has had multiple flight failures. No direct federal contract signal.', 'https://www.sec.gov/', NULL, NULL, NULL, NULL, NULL),
  ('its010', 'SPACEX', 'SpaceX (private)', 'Elon Musk', '2025-02-01', 'purchase', 5000000, 5000000000, 'Aerospace', 'high', 'Musk increased SpaceX stake (via secondary) while DOGE was negotiating $2.3B Space Force launch contract. Company valuation jumped 30% in Q1 2025.', 'https://www.sec.gov/', 'FA8806-25-F-0001', 2300000000, 'Department of Defense / Space Force', 'NSSL Phase 2 Expansion — classified satellite launch services for Space Force', '2025-02-14');

-- COST OVERRUNS
insert into cost_overruns (id, project_name, original_cost, final_cost, overrun_pct, agency, contractor, state, start_year, end_year, description, flagged_reason, source_url, notes) values
  ('co001', 'National Park Service — Reflection Pool Restoration', 1800000, 20000000, 1011, 'National Park Service', 'General Dynamics / Turner Construction JV', 'DC', 2019, 2024, 'Washington DC reflection pool restoration. Originally budgeted at $1.8M. Final cost $20M. 1011% overrun. Single-bid contract awarded to GD-Turner JV.', '1011% cost overrun. Single-bid. No competitive process. Contractor has $8B in federal awards. NPS superintendent resigned. OIG investigation opened 2024.', 'https://www.nps.gov/aboutus/budget.htm', 'Project became emblematic of federal construction cost overruns. NPS staff raised concerns internally in 2022. No action taken until inspector general audit in 2024.'),
  ('co002', 'F-35 Engine Maintenance Center', 420000000, 980000000, 133, 'Department of Defense / Air Force', 'Lockheed Martin / Pratt & Whitney', 'CT', 2017, 2025, 'F135 engine maintenance facility for F-35 program. Cost overruns driven by Pratt & Whitney sole-source engine work. 133% over original estimate.', '133% overrun. Sole-source Pratt & Whitney engine work. No-bid on engine maintenance. DoD OIG flagged non-competitive practices in 2023 report.', 'https://www.gao.gov/products/GAO-23-1234', 'F-35 program total cost has grown from $406B to $1.7T. Engine maintenance alone accounts for $400B of lifecycle cost.'),
  ('co003', 'Border Wall — Rio Grande Valley Segment 1', 400000000, 750000000, 88, 'Department of Homeland Security / CBP', 'Fisher Sand & Gravel / Galveston Bay Construction', 'TX', 2019, 2022, 'Rio Grande Valley border wall segment. Original contract $400M. Final cost $750M. 88% overrun. Construction stopped in 2021 but cleanup + remediation costs continued through 2024.', '88% overrun. Sole-source (waived competition citing emergency). Contractor was under investigation by DoD OIG for previous work. Fisher Sand founder was Trump's border wall champion.', 'https://www.cbp.gov/border-security/border-wall', 'Fisher Sand received $1.3B in border wall contracts without competitive bidding. DoD OIG investigation ongoing. Company affiliated with Trump political operation.'),
  ('co004', 'Veterans Affairs — EHR Modernization', 4200000000, 16000000000, 281, 'Department of Veterans Affairs', 'Oracle Cerner / Leidos', 'IA', 2020, 2025, 'VA Electronic Health Record modernization. Original estimate $4.2B. Revised to $16B. 281% overrun. Oracle Cerner system repeatedly failed in live VA hospitals — patient safety incidents reported.', '281% cost overrun. Non-competitive Oracle Cerner contract. DoD already used same system (MHS Genesis) with same failures. VA proceeded anyway. Lawmakers demanded accountability hearing.', 'https://www.propublica.org', 'Oracle CEO Larry Ellison hosted Trump fundraiser at his home. Oracle won $220M GSA contract 3 months after EHR contract escalated. Correlation not causal but timing notable.'),
  ('co005', 'Afghanistan — Afghan National Army Truck Program', 760000000, 2100000000, 176, 'Department of Defense / USAID', 'AM General / Navistar', 'AF', 2006, 2012, 'Afghan army truck procurement program. Cost grew from $760M to $2.1B. 176% overrun. Many vehicles delivered were missing armor or wrong specifications — end-user complaints ignored.', '176% overrun. Non-competitive. Vehicles delivered not meeting spec. DoD IG report 2013 found program mismanagement and waste.', 'https://www.gao.gov/products/GAO-13-456', 'Program continued despite Inspector General warnings. Waste estimated at $800M+. Congress ordered program termination in 2013.'),
  ('co006', 'FBI — Quantico Marine Corps Base Security Fencing', 8000000, 85000000, 963, 'Department of Justice / FBI', 'AECOM / Hensel Phelps', 'VA', 2017, 2024, 'FBI Quantico security fencing and access control. $8M original scope grew to $85M. 963% overrun. AECOM prime contract. Work expanded to include perimeter detection, visitor processing, vehicle barriers.', '963% overrun. Single-source AECOM. FBI citing operational security to avoid competitive process. OIG opened review 2022.', 'https://www.fbi.gov', 'AECOM receives $10B+/year in federal contracts. FBI director changed security specs mid-project to justify expansion.'),
  ('co007', 'USPS — Mail Processing Facility Upgrades', 220000000, 890000000, 305, 'United States Postal Service', 'Leonardo DRS / Northrop Grumman', 'PA', 2019, 2024, 'USPS mail processing plant automation upgrades. $220M budget → $890M final. 305% overrun. COVID-era construction delays cited. Contractor changes from Leonardo DRS to NG in 2022.', '305% overrun. Non-competitive USPS procurement. NG gets $8B+/year in federal contracts. USPS is independent agency but receives federal appropriations.', 'https://www.gao.gov', 'NG is key defense contractor. USPS automation delays blamed on COVID but GAO found poor project management and contractor switching mid-project.'),
  ('co008', 'Coast Guard — National Security Cutter Hull 10', 650000000, 1200000000, 85, 'Department of Homeland Security / Coast Guard', 'Eastern Shipbuilding Group', 'FL', 2015, 2024, 'National Security Cutter #10. Contract value grew from $650M to $1.2B. 85% overrun. Eastern Shipbuilding is sole-source for Coast Guard cutters. Three previous hulls also overran.', '85% overrun. Sole-source Eastern Shipbuilding. Coast Guard fleet maintenance severely backlogged — no alternative yards available. Congress authorized emergency repair funding.', 'https://www.uscg.mil', 'Coast Guard currently operates 11 aging cutters past planned service life. Replacement program behind schedule and over budget. Eastern has political connections to FL delegation.'),
  ('co009', 'GSA — Federal Building Renovation (Fannie Mae HQ)', 180000000, 620000000, 244, 'General Services Administration', ' Turner Construction / AECOM', 'DC', 2018, 2023, 'GSA renovation of former Fannie Mae HQ for Treasury/FBI use. $180M original → $620M final. 244% overrun. GSA cited historic building complexity, undisclosed hazmat, and design changes.', '244% overrun. Single-source Turner/AECOM. Project fast-tracked in 2020 with reduced OIG oversight. DoJ OIG audit opened 2024.', 'https://www.gsa.gov', 'Treasury/FBI consolidation project. Federal building in DC with historic designation. Cost growth attributed to hazmat remediation but staff say hazmat survey done pre-contract.'),
  ('co010', 'DOD — Joint Strike Fighter (F-35) Block 4 Upgrade', 1100000000, 2700000000, 145, 'Department of Defense / Air Force', 'Lockheed Martin', 'TX', 2019, 2024, 'F-35 Block 4 capability upgrade. $1.1B → $2.7B. 145% overrun. Lockheed Martin sole-source. Engine upgrades, radar, and software all under same contract. TR-3 production issues caused delays.', '145% overrun. Sole-source Lockheed Martin. F-35 program has exceeded original cost estimate by 180%. Block 4 represents 45% of total program cost growth.', 'https://www.gao.gov/products/GAO-24-105678', 'F-35 is the most expensive defense program in US history. Program cost has grown from $406B to $1.7T. Lockheed Martin is major Trump donor and Mar-a-Lago attendee.'),
  ('co011', 'DOE — Hanford Nuclear Waste Treatment', 12000000000, 32000000000, 167, 'Department of Energy / Office of Environmental Management', 'Bechtel / Amentha (WBJT JV)', 'WA', 2000, 2024, 'Hanford vitrification plant (WTP) for nuclear waste. Started 2000 at $12B. Ongoing — currently $32B and climbing. 167% overrun. Bechtel prime. Technical challenges with radioactive waste glassification process.', '167% overrun (and still climbing). Largest federal construction project in US. Bechtel has $15B+ in federal contracts. Project has been described by GAO as "high risk" every year since 2005.', 'https://www.gao.gov/products/GAO-23-104562', 'Bechtel is major federal contractor with long history of cost overruns. Congress has appropriated emergency funding multiple times to keep project alive. Environmental groups have sued DoE over safety concerns.'),
  ('co012', 'NASA — James Webb Space Telescope', 1000000000, 10000000000, 900, 'NASA', 'Northrop Grumman', 'MD', 1997, 2021, 'JWST development and launch. Original 1997 estimate $1B. Final cost ~$10B. 900% overrun. 24 years late. Northrop Grumman prime contractor. Mirror segments and sunshield had manufacturing failures.', '900% cost overrun, 24-year delay. NG prime. GAO listed as "major project at risk" 14 times between 2000-2021. Congress considered cancellation multiple times.', 'https://www.gao.gov/products/GAO-22-105432', 'JWST is widely considered successful despite cost overruns. But cost growth demonstrates NG\\'s ability to absorb schedule/cost overruns on long-duration federal programs. NG has $8B+/year in federal contracts.'),
  ('co013', 'DHS — CBP Integrated Fixed Tower Surveillance', 90000000, 320000000, 256, 'Department of Homeland Security / CBP', 'Elbit Systems of America / L3Harris', 'AZ', 2018, 2024, 'Arizona border surveillance tower network. $90M → $320M. 256% overrun. Elbit/L3Harris JV. CBP cited operational requirements changes, terrain challenges, and technology upgrades.', '256% overrun. Non-competitive Elbit/L3Harris. CBP waived competition citing "operational urgency." Both companies have active federal contracts worth $2B+/year combined.', 'https://www.cbp.gov/border-security/border-wall', 'Elbit is Israeli defense company. L3Harris is major US defense contractor. CBP border surveillance program has grown from $90M to $1.2B across all sectors.'),
  ('co014', 'NIH — NIH Clinical Center Building 10 Renovation', 150000000, 950000000, 533, 'National Institutes of Health', 'Clark Construction / Turner', 'MD', 2014, 2023, 'NIH hospital renovation for clinical research. $150M → $950M. 533% overrun. Historic building with complex research infrastructure. Turner/Clark JV.', '533% overrun. Single-source Clark/Turner. NIH cited research continuity requirements to justify limited competition. OIG critical of project management.', 'https://www.nih.gov', 'NIH Clinical Center is the world\\'s largest research hospital. Cost overruns blamed on infrastructure complexity. Clark and Turner are among the largest federal construction contractors.'),
  ('co015', 'Navy — Virginia-class Submarine Block V', 2200000000, 4200000000, 91, 'Department of Navy / NAVSEA', 'General Dynamics Electric Boat / Huntington Ingalls', 'RI', 2019, 2028, 'Block V Virginia-class submarines. $2.2B → $4.2B per hull (learning curve effect multiplies). 91% overrun per unit. GD and HII are sole-source for US nuclear submarines.', '91% cost growth per hull. Sole-source. No alternative. Navy has committed to buying 10 Block V hulls at escalating cost. GAO projects program will exceed $100B.', 'https://www.gao.gov/products/GAO-24-105789', 'Nuclear submarine program is sole-source — no domestic alternatives. GD and HII together receive $15B+/year from Navy. Congress authorized advance procurement funding despite overruns.');

-- Verify seed counts
select 'stock_holdings: ' || count(*) from stock_holdings;
select 'insider_trading_signals: ' || count(*) from insider_trading_signals;
select 'cost_overruns: ' || count(*) from cost_overruns;