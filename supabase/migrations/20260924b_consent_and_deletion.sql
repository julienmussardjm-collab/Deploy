-- Consent tracking and team-wide deletion. Applied 2026-09-24 after
-- 20260924_leads_and_team_access.sql; replaces sync_leads.
--
-- A deleted lead keeps only its id, dates, capturing user and event: every
-- personal field is wiped, and the deletion always wins, even over a later
-- edit made offline on another phone. list_leads returns tombstones too, so
-- the other phones drop the lead.

alter table public.leads
  add column consent boolean not null default false,
  add column consent_at timestamptz,
  add column deleted_at timestamptz;

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
  with incoming as (
    select x, (x->>'deletedAt') is not null as del
    from jsonb_array_elements(p_leads) as x
  )
  insert into public.leads as l (
    id, badge_id, name, title, company, country, email, phone, interests,
    action, priority, notes, captured_by, captured_by_initials, event_name,
    event_location, raw_scan, consent, consent_at, captured_at, updated_at,
    deleted_at
  )
  select
    (x->>'id')::uuid,
    case when del then '' else coalesce(x->>'badgeId', '') end,
    case when del then '' else coalesce(x->>'name', '') end,
    case when del then '' else coalesce(x->>'title', '') end,
    case when del then '' else coalesce(x->>'company', '') end,
    case when del then '' else coalesce(x->>'country', '') end,
    case when del then '' else coalesce(x->>'email', '') end,
    case when del then '' else coalesce(x->>'phone', '') end,
    case when del then '{}'::text[] else coalesce(array(select jsonb_array_elements_text(x->'interests')), '{}') end,
    case when del then '' else coalesce(x->>'action', '') end,
    case when del then '' else coalesce(x->>'priority', '') end,
    case when del then '' else coalesce(x->>'notes', '') end,
    x->>'capturedBy',
    x->>'capturedByInitials',
    x->>'eventName',
    x->>'eventLocation',
    case when del then null else x->>'rawScan' end,
    not del and coalesce((x->>'consent')::boolean, false),
    case when del or x->>'consentAt' is null then null
         else to_timestamp((x->>'consentAt')::double precision / 1000) end,
    to_timestamp((x->>'capturedAt')::double precision / 1000),
    to_timestamp(coalesce((x->>'updatedAt')::double precision, (x->>'capturedAt')::double precision) / 1000),
    case when del then to_timestamp((x->>'deletedAt')::double precision / 1000) end
  from incoming
  on conflict (id) do update set
    badge_id = case when l.deleted_at is null then excluded.badge_id else '' end,
    name = case when l.deleted_at is null then excluded.name else '' end,
    title = case when l.deleted_at is null then excluded.title else '' end,
    company = case when l.deleted_at is null then excluded.company else '' end,
    country = case when l.deleted_at is null then excluded.country else '' end,
    email = case when l.deleted_at is null then excluded.email else '' end,
    phone = case when l.deleted_at is null then excluded.phone else '' end,
    interests = case when l.deleted_at is null then excluded.interests else '{}' end,
    action = case when l.deleted_at is null then excluded.action else '' end,
    priority = case when l.deleted_at is null then excluded.priority else '' end,
    notes = case when l.deleted_at is null then excluded.notes else '' end,
    raw_scan = case when l.deleted_at is null then excluded.raw_scan end,
    consent = l.deleted_at is null and excluded.consent,
    consent_at = case when l.deleted_at is null then excluded.consent_at end,
    deleted_at = coalesce(l.deleted_at, excluded.deleted_at),
    updated_at = greatest(l.updated_at, excluded.updated_at),
    received_at = now()
  where l.updated_at <= excluded.updated_at or excluded.deleted_at is not null
  returning l.id;
end;
$$;

revoke all on function public.sync_leads(text, jsonb) from public, authenticated;
grant execute on function public.sync_leads(text, jsonb) to anon;
