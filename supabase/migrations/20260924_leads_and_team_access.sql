-- Team lead database for the Lead Scanner (Supabase project
-- inventronics-lead-scanner, eu-central-1). Applied 2026-09-24.
--
-- The leads table is closed to the API (RLS on, no policies, no grants).
-- Devices go through sync_leads / list_leads, which check the shared team
-- code first. Set or rotate the code with:
--   insert into public.team_access (id, code_hash)
--   values (1, extensions.crypt('<NEW CODE>', extensions.gen_salt('bf', 10)))
--   on conflict (id) do update set code_hash = excluded.code_hash;
-- Every phone then has to enter the new code once.

create extension if not exists pgcrypto with schema extensions;

create table public.leads (
  id uuid primary key,
  badge_id text not null,
  name text not null,
  title text not null default '',
  company text not null default '',
  country text not null default '',
  email text not null default '',
  phone text not null default '',
  interests text[] not null default '{}',
  action text not null default '',
  priority text not null default '',
  notes text not null default '',
  captured_by text,
  captured_by_initials text,
  event_name text,
  event_location text,
  raw_scan text,
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index leads_updated_at_idx on public.leads (updated_at);
create index leads_badge_id_idx on public.leads (badge_id);

create table public.team_access (
  id int primary key default 1 check (id = 1),
  code_hash text not null
);

alter table public.leads enable row level security;
alter table public.team_access enable row level security;
revoke all on public.leads from anon, authenticated;
revoke all on public.team_access from anon, authenticated;

create or replace function public.team_code_ok(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
begin
  select extensions.crypt(coalesce(p_code, ''), code_hash) = code_hash
    into ok
    from public.team_access
   where id = 1;
  if not coalesce(ok, false) then
    perform pg_sleep(1); -- slows down guessing
    return false;
  end if;
  return true;
end;
$$;

-- Inserts or updates leads sent by a device. A row only changes when the
-- incoming copy is newer, so an old offline edit cannot overwrite a newer one.
create or replace function public.sync_leads(p_code text, p_leads jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_code_ok(p_code) then
    raise exception 'invalid team code' using errcode = '28000';
  end if;

  return query
  insert into public.leads as l (
    id, badge_id, name, title, company, country, email, phone, interests,
    action, priority, notes, captured_by, captured_by_initials, event_name,
    event_location, raw_scan, captured_at, updated_at
  )
  select
    (x->>'id')::uuid,
    coalesce(x->>'badgeId', ''),
    coalesce(x->>'name', ''),
    coalesce(x->>'title', ''),
    coalesce(x->>'company', ''),
    coalesce(x->>'country', ''),
    coalesce(x->>'email', ''),
    coalesce(x->>'phone', ''),
    coalesce(array(select jsonb_array_elements_text(x->'interests')), '{}'),
    coalesce(x->>'action', ''),
    coalesce(x->>'priority', ''),
    coalesce(x->>'notes', ''),
    x->>'capturedBy',
    x->>'capturedByInitials',
    x->>'eventName',
    x->>'eventLocation',
    x->>'rawScan',
    to_timestamp((x->>'capturedAt')::double precision / 1000),
    to_timestamp(coalesce((x->>'updatedAt')::double precision, (x->>'capturedAt')::double precision) / 1000)
  from jsonb_array_elements(p_leads) as x
  on conflict (id) do update set
    badge_id = excluded.badge_id,
    name = excluded.name,
    title = excluded.title,
    company = excluded.company,
    country = excluded.country,
    email = excluded.email,
    phone = excluded.phone,
    interests = excluded.interests,
    action = excluded.action,
    priority = excluded.priority,
    notes = excluded.notes,
    raw_scan = excluded.raw_scan,
    updated_at = excluded.updated_at,
    received_at = now()
  where l.updated_at <= excluded.updated_at
  returning l.id;
end;
$$;

-- Leads received since p_since (all leads when null), for the team view.
create or replace function public.list_leads(p_code text, p_since timestamptz default null)
returns setof public.leads
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_code_ok(p_code) then
    raise exception 'invalid team code' using errcode = '28000';
  end if;
  return query
    select * from public.leads
     where p_since is null or received_at > p_since
     order by captured_at desc;
end;
$$;

revoke all on function public.team_code_ok(text) from public, authenticated;
revoke all on function public.sync_leads(text, jsonb) from public, authenticated;
revoke all on function public.list_leads(text, timestamptz) from public, authenticated;
grant execute on function public.team_code_ok(text) to anon;
grant execute on function public.sync_leads(text, jsonb) to anon;
grant execute on function public.list_leads(text, timestamptz) to anon;
