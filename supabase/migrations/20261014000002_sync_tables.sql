-- Shared records: pantry items, weekly menu entries and shopping list ticks.
--
-- Every table follows the same contract, which the app's sync engine relies on:
--
--   * identity is (household_id, <natural key>), so an upsert is idempotent
--   * a delete is a tombstone (`deleted = true`), never a DELETE, so it can sync
--   * `updated_at` and `updated_by` are assigned by the server in a trigger and
--     cannot be set by a client: last-write-wins uses the server clock only
--   * a write that changes nothing keeps its old `updated_at`, so replaying a
--     push after a lost response does not re-stamp the record

-- ---------------------------------------------------------------------------
-- Server-side stamping and guard
-- ---------------------------------------------------------------------------
-- Trigger arguments: the names of the natural key columns of the table.
create function private.sync_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  i int;
begin
  if tg_op = 'INSERT' then
    -- Whatever the client sent for these two is overwritten.
    new.updated_at := clock_timestamp();
    new.updated_by := (select auth.uid());
    return new;
  end if;

  -- UPDATE (including the DO UPDATE branch of an upsert).
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id cannot change' using errcode = '42501';
  end if;
  for i in 0 .. tg_nargs - 1 loop
    if (to_jsonb(new) ->> tg_argv[i]) is distinct from (to_jsonb(old) ->> tg_argv[i]) then
      raise exception 'key column % cannot change', tg_argv[i] using errcode = '42501';
    end if;
  end loop;

  -- Same content as before: keep the previous stamp. This also discards any
  -- updated_at the client tried to write, because it is excluded from the test.
  if (to_jsonb(new) - 'updated_at' - 'updated_by') = (to_jsonb(old) - 'updated_at' - 'updated_by') then
    return old;
  end if;

  -- Strictly increasing per record, even if the clock steps back.
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function private.sync_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- pantry_items
-- ---------------------------------------------------------------------------
create table public.pantry_items (
  household_id     uuid not null references public.households (id) on delete cascade,
  ingredient_id    text not null check (char_length(ingredient_id) between 1 and 120),
  display_name     text check (char_length(display_name) <= 120),
  category         text check (char_length(category) <= 32),
  default_unit     text check (char_length(default_unit) <= 32),
  amount           double precision check (amount >= 0 and amount < 1e9),
  unit             text check (char_length(unit) <= 32),
  threshold_amount double precision check (threshold_amount >= 0 and threshold_amount < 1e9),
  threshold_unit   text check (char_length(threshold_unit) <= 32),
  expires_at       bigint,
  deleted          boolean not null default false,
  updated_at       timestamptz not null default clock_timestamp(),
  updated_by       uuid,
  primary key (household_id, ingredient_id),
  -- A tombstone carries no data; a live row must be complete.
  constraint pantry_items_live_shape check (
    deleted or (
      display_name is not null and category is not null and default_unit is not null
      and amount is not null and unit is not null
    )
  )
);

create index pantry_items_pull_idx on public.pantry_items (household_id, updated_at);

create trigger pantry_items_guard
  before insert or update on public.pantry_items
  for each row execute function private.sync_guard('ingredient_id');

-- ---------------------------------------------------------------------------
-- meal_plan_entries
-- ---------------------------------------------------------------------------
create table public.meal_plan_entries (
  household_id uuid not null references public.households (id) on delete cascade,
  date         date not null,
  slot         text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  dish_id      text check (char_length(dish_id) <= 200),
  dish_title   text check (char_length(dish_title) <= 200),
  summary      text check (char_length(summary) <= 2000),
  ingredients  jsonb check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 100),
  deleted      boolean not null default false,
  updated_at   timestamptz not null default clock_timestamp(),
  updated_by   uuid,
  primary key (household_id, date, slot),
  constraint meal_plan_entries_live_shape check (
    deleted or (
      dish_id is not null and dish_title is not null and summary is not null
      and ingredients is not null
    )
  )
);

create index meal_plan_entries_pull_idx on public.meal_plan_entries (household_id, updated_at);

create trigger meal_plan_entries_guard
  before insert or update on public.meal_plan_entries
  for each row execute function private.sync_guard('date', 'slot');

-- ---------------------------------------------------------------------------
-- shopping_items: a row exists (not deleted) while the item is ticked.
-- ---------------------------------------------------------------------------
create table public.shopping_items (
  household_id uuid not null references public.households (id) on delete cascade,
  item_key     text not null check (char_length(item_key) between 1 and 120),
  name         text check (char_length(name) <= 120),
  deleted      boolean not null default false,
  updated_at   timestamptz not null default clock_timestamp(),
  updated_by   uuid,
  primary key (household_id, item_key),
  constraint shopping_items_live_shape check (deleted or name is not null)
);

create index shopping_items_pull_idx on public.shopping_items (household_id, updated_at);

create trigger shopping_items_guard
  before insert or update on public.shopping_items
  for each row execute function private.sync_guard('item_key');

-- ---------------------------------------------------------------------------
-- Row Level Security: members of the household, and nobody else.
-- No DELETE policy and no DELETE privilege: removal is a tombstone update.
-- ---------------------------------------------------------------------------
alter table public.pantry_items      enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_items    enable row level security;

create policy pantry_items_select on public.pantry_items
  for select to authenticated using (private.is_member(household_id));
create policy pantry_items_insert on public.pantry_items
  for insert to authenticated with check (private.is_member(household_id));
create policy pantry_items_update on public.pantry_items
  for update to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy meal_plan_entries_select on public.meal_plan_entries
  for select to authenticated using (private.is_member(household_id));
create policy meal_plan_entries_insert on public.meal_plan_entries
  for insert to authenticated with check (private.is_member(household_id));
create policy meal_plan_entries_update on public.meal_plan_entries
  for update to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy shopping_items_select on public.shopping_items
  for select to authenticated using (private.is_member(household_id));
create policy shopping_items_insert on public.shopping_items
  for insert to authenticated with check (private.is_member(household_id));
create policy shopping_items_update on public.shopping_items
  for update to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

revoke all on public.pantry_items      from anon, authenticated;
revoke all on public.meal_plan_entries from anon, authenticated;
revoke all on public.shopping_items    from anon, authenticated;
grant select, insert, update on public.pantry_items      to authenticated;
grant select, insert, update on public.meal_plan_entries to authenticated;
grant select, insert, update on public.shopping_items    to authenticated;

-- ---------------------------------------------------------------------------
-- Maintenance: purge old tombstones. Not scheduled and not callable from the
-- API; run it by hand from the SQL editor if the tables ever grow. A phone that
-- stayed offline longer than `p_older_than` may keep a record that was deleted
-- meanwhile (see docs/SHARING.md).
-- ---------------------------------------------------------------------------
create function private.purge_tombstones(p_older_than interval default interval '180 days')
returns void
language sql
set search_path = ''
as $$
  delete from public.pantry_items      where deleted and updated_at < now() - p_older_than;
  delete from public.meal_plan_entries where deleted and updated_at < now() - p_older_than;
  delete from public.shopping_items    where deleted and updated_at < now() - p_older_than;
$$;

revoke all on function private.purge_tombstones(interval) from public, anon, authenticated;
