-- RecetApp shared households: identity-independent groups, membership and invites.
--
-- Security model in one paragraph: every table has Row Level Security enabled and
-- the client roles have no write access to any household table. All changes to
-- households, members and invites go through the SECURITY DEFINER functions at
-- the bottom of this file, each of which derives the caller from auth.uid() and
-- never accepts a user id as an argument. See docs/SHARING.md for the review.

-- ---------------------------------------------------------------------------
-- Private schema: helpers and bookkeeping that must not be reachable over the API.
-- Supabase only exposes the schemas listed in the API settings (public by
-- default), so nothing in here is callable through PostgREST.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- authenticated needs USAGE so the RLS policies can call private.is_member().
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('owner', 'member')),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per identity. The client assumes it, and it keeps RLS simple.
  unique (user_id)
);

create index household_members_household_idx on public.household_members (household_id);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- 8 symbols from a 30 character alphabet without look-alikes (no 0 O 1 I L U).
  code         text not null unique check (code ~ '^[2-9A-HJKMNP-TV-Z]{8}$'),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  used_by      uuid references auth.users (id) on delete set null,
  used_at      timestamptz
);

create index household_invites_household_idx on public.household_invites (household_id);

-- Failed join attempts, for throttling. Never exposed: it lives in the private schema.
create table private.join_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  attempted_at timestamptz not null default now()
);

create index join_attempts_user_idx on private.join_attempts (user_id, attempted_at);
create index join_attempts_time_idx on private.join_attempts (attempted_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table private.join_attempts    enable row level security; -- no policy: nobody but definer functions

-- Membership test used by every policy. SECURITY DEFINER so it can read
-- household_members without recursing into that table's own policy; the empty
-- search_path stops a caller from shadowing the tables it reads.
create function private.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

-- Read-only for members. There are deliberately no INSERT, UPDATE or DELETE policies.
create policy households_select on public.households
  for select to authenticated
  using (private.is_member(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (private.is_member(household_id));

-- Members see the codes of their own household's invites (to show them); nobody
-- else sees any invite, so a code can never be read by someone who is not in.
create policy household_invites_select on public.household_invites
  for select to authenticated
  using (private.is_member(household_id));

-- Belt and braces: even without a policy, remove the privileges. Supabase's
-- default grants hand all of them to anon and authenticated.
revoke all on public.households        from anon, authenticated;
revoke all on public.household_members from anon, authenticated;
revoke all on public.household_invites from anon, authenticated;
grant select on public.households        to authenticated;
grant select on public.household_members to authenticated;
grant select on public.household_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Invite code generation
-- ---------------------------------------------------------------------------
-- Draws from gen_random_uuid(), which Postgres fills from its strong random
-- source. Bytes 6 and 8 carry the UUID version and variant bits, so they are
-- skipped. Bytes >= 240 are rejected so every symbol has the same probability
-- (240 = 8 * 30); plain `byte % 30` would favour the first 16 symbols.
create function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code     text := '';
  v_bytes    bytea;
  v_byte     int;
  i          int;
begin
  while char_length(v_code) < 8 loop
    v_bytes := uuid_send(gen_random_uuid());
    for i in 0..15 loop
      continue when i in (6, 8);
      v_byte := get_byte(v_bytes, i);
      if v_byte < 240 then
        v_code := v_code || substr(v_alphabet, (v_byte % 30) + 1, 1);
      end if;
      exit when char_length(v_code) = 8;
    end loop;
  end loop;
  return v_code;
end;
$$;

revoke all on function private.generate_invite_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs. Each one: SECURITY DEFINER, empty search_path, fully qualified names,
-- caller taken from auth.uid(), EXECUTE only for signed-in (anonymous) users.
-- ---------------------------------------------------------------------------

create function public.create_household(p_name text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_id, v_uid, 'owner', nullif(btrim(p_display_name), ''));

  return v_id;
end;
$$;

-- Creates a single-use invite valid for 24 hours. Any member may create one;
-- at most 5 can be outstanding so a member cannot flood the table.
create function public.create_invite(p_household_id uuid)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid     uuid := (select auth.uid());
  v_active  int;
  v_code    text;
  v_expires timestamptz := now() + interval '24 hours';
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_member(p_household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  select count(*) into v_active
  from public.household_invites i
  where i.household_id = p_household_id
    and i.revoked_at is null
    and i.used_at is null
    and i.expires_at > now();
  if v_active >= 5 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;

  loop
    v_code := private.generate_invite_code();
    begin
      insert into public.household_invites (household_id, code, created_by, expires_at)
      values (p_household_id, v_code, v_uid, v_expires)
      returning public.household_invites.id into v_id;
      exit;
    exception when unique_violation then
      -- Astronomically unlikely; draw again.
      null;
    end;
  end loop;

  return query select v_id, v_code, v_expires;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Silent when the invite is unknown or belongs to a household the caller is
  -- not in, so the function cannot be used to probe for invite ids.
  update public.household_invites i
  set revoked_at = now()
  where i.id = p_invite_id
    and i.revoked_at is null
    and private.is_member(i.household_id);
end;
$$;

-- Redeems an invite code.
--
-- Returns a status instead of raising on a bad code. That is required, not a
-- style choice: a raised exception rolls the transaction back, and with it the
-- row that records the failed attempt, which would disable the throttle.
--
-- Unknown, expired, revoked and already used codes all answer 'invalid', so the
-- response tells a guesser nothing about which codes exist.
create function public.join_household(p_code text, p_display_name text default null)
returns table (status text, household_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid     uuid := (select auth.uid());
  v_code    text;
  v_invite  public.household_invites%rowtype;
  v_recent  int;
  v_global  int;
  v_members int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from private.join_attempts a where a.attempted_at < now() - interval '1 day';

  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    return query select 'already_member'::text, null::uuid;
    return;
  end if;

  -- Throttle failed attempts: 5 per identity per 15 minutes, and 300 per hour
  -- across everyone. The global cap matters because anonymous identities are
  -- cheap to mint, so a per-identity limit alone does not stop a determined
  -- guesser (see docs/SHARING.md for the numbers and the denial-of-service trade-off).
  select count(*) into v_recent
  from private.join_attempts a
  where a.user_id = v_uid and a.attempted_at > now() - interval '15 minutes';

  select count(*) into v_global
  from private.join_attempts a
  where a.attempted_at > now() - interval '1 hour';

  if v_recent >= 5 or v_global >= 300 then
    return query select 'throttled'::text, null::uuid;
    return;
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  -- FOR UPDATE: two people redeeming the same code at once are serialized, and
  -- only the first still sees it as unused.
  select * into v_invite
  from public.household_invites i
  where i.code = v_code
    and i.revoked_at is null
    and i.used_at is null
    and i.expires_at > now()
  for update;

  if not found then
    insert into private.join_attempts (user_id) values (v_uid);
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select count(*) into v_members
  from public.household_members m
  where m.household_id = v_invite.household_id;
  if v_members >= 10 then
    return query select 'full'::text, null::uuid;
    return;
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_invite.household_id, v_uid, 'member', nullif(btrim(p_display_name), ''));

  update public.household_invites i
  set used_by = v_uid, used_at = now()
  where i.id = v_invite.id;

  return query select 'ok'::text, v_invite.household_id;
end;
$$;

-- Removes the caller's own membership. It takes no arguments, so it cannot be
-- pointed at anyone else. The last member out deletes the household (and, by
-- cascade, its invites and data); an owner leaving hands ownership to the
-- longest-standing member.
create function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := (select auth.uid());
  v_household uuid;
  v_role      text;
  v_next      uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select m.household_id, m.role into v_household, v_role
  from public.household_members m
  where m.user_id = v_uid;

  if not found then
    return; -- Already out: leaving twice is not an error.
  end if;

  -- Serialize concurrent leaves of the same household, so the "last one out"
  -- check below cannot be fooled by two people leaving at once.
  perform 1 from public.households h where h.id = v_household for update;

  delete from public.household_members m where m.user_id = v_uid;

  select m.user_id into v_next
  from public.household_members m
  where m.household_id = v_household
  order by m.joined_at, m.user_id
  limit 1;

  if v_next is null then
    delete from public.households h where h.id = v_household;
  elsif v_role = 'owner' then
    update public.household_members m
    set role = 'owner'
    where m.household_id = v_household and m.user_id = v_next;
  end if;
end;
$$;

-- The caller's household, if any. SECURITY INVOKER: it only reads what RLS
-- already lets the caller read.
create function public.get_my_household()
returns table (household_id uuid, name text, role text, joined_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.household_id, h.name, m.role, m.joined_at
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid());
$$;

-- Functions are executable by PUBLIC by default, and Supabase also grants them to
-- anon. Only signed-in (including anonymously signed-in) users may call these.
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.create_invite(uuid)          from public, anon;
revoke all on function public.revoke_invite(uuid)          from public, anon;
revoke all on function public.join_household(text, text)   from public, anon;
revoke all on function public.leave_household()            from public, anon;
revoke all on function public.get_my_household()           from public, anon;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_invite(uuid)          to authenticated;
grant execute on function public.revoke_invite(uuid)          to authenticated;
grant execute on function public.join_household(text, text)   to authenticated;
grant execute on function public.leave_household()            to authenticated;
grant execute on function public.get_my_household()           to authenticated;
