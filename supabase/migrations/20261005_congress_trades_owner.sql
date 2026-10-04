-- R4: who held the asset on a disclosed trade. Senate eFD lists an Owner on every PTR row
-- (Self / Spouse / Joint / Dependent Child). A spouse's sale is not the senator's own trade,
-- so a story that says "Senator X sold" needs this. Same-day lots with different owners are
-- folded into one row (the unique key has no owner), so the value can be a list: 'Self, Spouse'.
-- Additive and idempotent; holds no data.
alter table congress_trades add column if not exists owner text;
comment on column congress_trades.owner is 'Asset owner as disclosed: Self, Spouse, Joint, Dependent Child; comma-separated when same-day lots of different owners share one row. Senate eFD only so far (House PTRs carry SP/DC/JT codes).';
