# Supabase setup for shared households

Sharing is optional. Until the two environment variables below are set, the app
runs exactly as before: local only, no account, no network. The design is in
[docs/SHARING.md](../docs/SHARING.md).

## Steps (all manual, about 15 minutes)

1. **Create a project** at <https://supabase.com/dashboard> (free tier is enough).
   Pick the region closest to your users and save the database password in a
   password manager. The app never uses it.
2. **Enable anonymous sign-ins**: Authentication, then Sign In / Providers, turn on
   **Allow anonymous sign-ins**. Leave every other provider off.
3. **Run the migrations in order** in the SQL editor (or with `supabase db push` if
   you use the CLI). Run each file once, as a whole:
   1. `migrations/20261014000001_households.sql`
   2. `migrations/20261014000002_sync_tables.sql`
   3. `migrations/20261014000003_realtime.sql`
4. **Check Realtime** (the third migration does this for you): Database, Replication,
   `supabase_realtime`: `pantry_items`, `meal_plan_entries` and `shopping_items`
   must be listed. If one is missing, switch it on there.
5. **Abuse protection** (Authentication, Rate Limits and Attack Protection):
   keep the default limit on anonymous sign-ins per hour per IP (30). Turn on
   CAPTCHA protection later if you ever see abuse; it needs a client change.
6. **Copy the two values** from Project Settings, API Keys:
   - Project URL, like `https://abcdefgh.supabase.co`
   - the **publishable** key, `sb_publishable_...`. Never the secret key
     (`sb_secret_...`) or the `service_role` key: those bypass Row Level Security and
     must never reach the app.

## Wire the values into the app

The variable names are fixed:

| Variable                   | Value               |
| -------------------------- | ------------------- |
| `EXPO_PUBLIC_SUPABASE_URL` | the project URL     |
| `EXPO_PUBLIC_SUPABASE_KEY` | the publishable key |

- **Local development**: put them in `apps/mobile/.env.local` (git-ignored).
- **EAS builds and updates**: add both to the EAS `preview` environment (and
  `production` when you ship it), either in the Expo dashboard under Environment
  variables or with:

  ```bash
  cd apps/mobile
  eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value <url> --visibility plaintext
  eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_KEY --value <key> --visibility plaintext
  ```

  Alternatively add them under `build.<profile>.env` in `apps/mobile/eas.json`, next to
  `EXPO_PUBLIC_API_URL`. Either is fine because both values are public by design
  (they end up inside the bundle); what protects the data is Row Level Security.
  They are not committed with real values in this repository.

- **OTA**: `eas update --channel preview` bundles the values from the environment of
  that channel's build profile. Publishing the update from an environment without
  the variables produces a bundle with sharing switched off.

No new native module is involved, so a household feature ships through an OTA update.

## Verifying the setup

In the SQL editor, with the project freshly migrated:

```sql
-- 1. Every table has RLS on (expect 7 rows, all true).
select schemaname, tablename, rowsecurity
from pg_tables
where (schemaname = 'public' and tablename in
        ('households','household_members','household_invites',
         'pantry_items','meal_plan_entries','shopping_items'))
   or (schemaname = 'private' and tablename = 'join_attempts');

-- 2. The client roles hold no write privilege on household tables (expect no rows).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('households','household_members','household_invites')
  and grantee in ('anon','authenticated')
  and privilege_type <> 'SELECT';

-- 3. Nothing is callable by anon (expect no rows).
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public' and grantee in ('anon', 'PUBLIC');
```

## Operating notes

- **Reset a test project**: `drop schema public cascade; drop schema private cascade;
create schema public;` then grant usage on `public` again to the usual roles, and rerun the
  migrations. Do this only on a throwaway project.
- **Old tombstones** accumulate slowly. `select private.purge_tombstones();` (SQL editor
  only) deletes the ones older than 180 days; see docs/SHARING.md for the trade-off.
- **Anonymous users** that never come back can be cleaned up from Authentication, Users.
  Deleting one removes its membership.
- **Backups**: the free tier has none you can restore from. The phones keep a full local
  copy of every household's data, which is the practical backup.
