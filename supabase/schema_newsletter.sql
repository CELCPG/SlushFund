-- Newsletter subscribers — public can insert, only service role can read.
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  created_at timestamptz not null default now(),
  confirmed boolean not null default false,
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_created_at_idx
  on newsletter_subscribers (created_at desc);

alter table newsletter_subscribers enable row level security;

drop policy if exists "Public can subscribe" on newsletter_subscribers;
create policy "Public can subscribe"
  on newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);
