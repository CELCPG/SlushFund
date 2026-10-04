-- R3: every congress_trades row keeps the id of the filing it was parsed from
-- (data-rules s2). House Clerk: DocID of the PTR PDF, whose public URL is stored in
-- disclosure_url (https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/<year>/<DocID>.pdf).
-- Additive and idempotent; holds no data.
alter table congress_trades add column if not exists source_doc_id text;
comment on column congress_trades.source_doc_id is 'Id of the source filing (House Clerk PTR DocID; Senate eFD report id). disclosure_url is the public link.';
create index if not exists congress_trades_source_doc_idx
  on congress_trades (source_doc_id) where source_doc_id is not null;
