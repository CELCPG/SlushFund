-- F1 (A8 L5): reader error reports from the /report-an-error form.
-- The site's anon key may INSERT a report and nothing else: no SELECT, UPDATE or DELETE (column grants
-- plus RLS). Apex's local forwarding script reads and marks rows with the service key, which is never
-- in Vercel. Idempotent: safe to apply twice.

create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- a slushfund.net path ("/people/G000583") or a full slushfund.net address
  page_url text not null,
  message text not null,
  contact text,
  -- sha-256 hex of the browser's user agent, never the user agent itself
  user_agent_hash text,
  status text not null default 'new',
  forwarded_at timestamptz,
  constraint error_reports_page_url_check check (
    char_length(page_url) <= 500
    and (page_url ~ '^/([^/\\]|$)' or page_url ~ '^https://(www\.)?slushfund\.net(/|$)')
  ),
  constraint error_reports_message_check check (char_length(btrim(message)) between 10 and 4000),
  constraint error_reports_contact_check check (contact is null or char_length(contact) <= 200),
  constraint error_reports_ua_hash_check check (user_agent_hash is null or user_agent_hash ~ '^[0-9a-f]{16,64}$'),
  constraint error_reports_status_check check (status in ('new', 'forwarded', 'closed'))
);

create index if not exists error_reports_new_idx on public.error_reports (created_at) where status = 'new';

alter table public.error_reports enable row level security;

-- Supabase's default privileges grant every new public table to anon and authenticated: take them back,
-- then give anon INSERT on the four reader columns only (id, created_at, status, forwarded_at keep their defaults).
revoke all on table public.error_reports from public, anon, authenticated;
grant insert (page_url, message, contact, user_agent_hash) on table public.error_reports to anon;
grant all on table public.error_reports to service_role;

drop policy if exists error_reports_anon_insert on public.error_reports;
create policy error_reports_anon_insert on public.error_reports
  for insert to anon
  with check (status = 'new' and forwarded_at is null);

comment on table public.error_reports is
  'F1: reader error reports from /report-an-error. anon: INSERT only (4 columns). Forwarded by a local script with the service key.';

notify pgrst, 'reload schema';
