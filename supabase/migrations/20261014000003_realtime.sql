-- Publish row changes of the shared tables to Supabase Realtime.
--
-- Realtime evaluates the Row Level Security policies of the subscribed user for
-- every change, so a phone only receives rows of its own household. Only the
-- three data tables are published: membership and invites are read on demand.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Plain Postgres (for example a local test database) has no Realtime.
    return;
  end if;

  foreach t in array array['pantry_items', 'meal_plan_entries', 'shopping_items'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- Already published, for example enabled by hand in the dashboard.
    end;
  end loop;
end;
$$;
