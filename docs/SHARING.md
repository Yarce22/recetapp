# Shared households

Two or more people manage one pantry, one weekly menu and one shopping list. It is
opt-in: **solo mode is unchanged** (no account, no network, nothing queued).

Backend: Supabase (Postgres, Realtime, anonymous auth). Setup steps for the owner
are in [`supabase/README.md`](../supabase/README.md).

## What is shared

| Shared                          | Not shared (stays on the device)      |
| ------------------------------- | ------------------------------------- |
| Pantry items                    | Language                              |
| Weekly menu entries             | Preferences, staples, dietary choices |
| Shopping list ticks (see below) | The anonymous device id used by BFF   |

The shopping list itself is derived from the pantry and the menu, so it is shared
by construction. What gets stored is only which items are **ticked**.

## Data model

Server (all in `supabase/migrations/`):

```
households(id, name, created_by, created_at)
household_members(household_id, user_id, role owner|member, display_name, joined_at)   unique(user_id)
household_invites(id, household_id, code, expires_at, revoked_at, used_by, used_at)
pantry_items(household_id, ingredient_id, ...columns..., deleted, updated_at, updated_by)
meal_plan_entries(household_id, date, slot, ...columns..., deleted, updated_at, updated_by)
shopping_items(household_id, item_key, name, deleted, updated_at, updated_by)
private.join_attempts(user_id, attempted_at)       -- throttle bookkeeping, not exposed
```

- An identity belongs to **one** household at a time (`unique(user_id)`).
- A household has at most 10 members and at most 5 outstanding invites.
- Data tables are keyed by `(household_id, natural key)`, so every write is an
  idempotent upsert. The columns mirror the local SQLite tables.
- Identity is `signInAnonymously()`: no email, no password. The session is stored
  in the app's own `settings` table (key prefix `supabase-auth:`).

Device (SQLite migration 5): `shopping_checks` (the ticks), `sync_outbox`,
`sync_meta`, `sync_state`. The household the device belongs to is kept in
`settings` under `household`.

## Sync algorithm

SQLite stays the source of truth for the UI. The app reads and writes it exactly as
before; sharing happens around it.

**Writes (push queue).** The pantry, plan and ticks repositories are wrapped by
decorators. Inside a household, every write runs `local write -> enqueue` as one
step under an in-process lock. The outbox holds **one row per record** (a newer
change replaces an older one) with a `rev` counter. In solo mode the decorator is a
pass-through. The UI never awaits the network: it awaits SQLite only, and a
debounced (400 ms) background cycle does the rest.

**A cycle** (single-flight; one more is queued if another was requested meanwhile):

1. **Pull**, per entity: fetch rows with `updated_at` after the saved cursor
   (minus a 10 s overlap), oldest first, 500 per page, and merge each one.
2. If a join or create asked for it, **queue the local records** the household has
   never heard of (see below).
3. **Push**: send the outbox in batches of 50 as upserts. The server answers with
   the stored rows. For each, `acknowledge(entity, key, rev)` removes the queue entry
   **only if its `rev` is unchanged** (an edit made while the push was in flight stays
   queued), and the returned `updated_at` is saved as the record's version.

**Realtime.** One channel per household subscribes to `postgres_changes` on the three
tables, filtered by `household_id`. Each event goes through the same merge as a pull.
When the channel drops and comes back, a full cycle catches up. Foreground also
triggers a cycle.

**Merge (`decideMerge`), per record, using only server timestamps:**

1. A record with an unpushed local change always keeps the local version on this
   device (it will win at the server too, being the last write to arrive).
2. A remote version not strictly newer than the last one merged (`sync_meta`) is an
   echo or a stale read: ignored.
3. Newer tombstone: delete locally. Newer live version: apply (this revives a record).

Timestamps are compared in **microseconds**, because Postgres sends microseconds and
two writes under a millisecond apart must not look equal.

**Clocks.** The server assigns `updated_at` (a trigger, `clock_timestamp()`, strictly
increasing per record). Device clocks are never compared, so a phone with a wrong
clock cannot win or lose conflicts. The consequence is that "last write" means
**last to reach the server**: an edit made offline at 9:00 and pushed at 12:00 beats
an online edit made at 11:00. That is the accepted trade-off of server-assigned time;
the alternative (client clocks) fails worse.

**Granularity.** Last-write-wins is per record, not per field: two people editing
different fields of the same pantry item at the same time keep one of the two edits.

**Tombstones.** Deleting writes `deleted = true` with the value columns null. Because
of rule 2, an older live echo can never resurrect a deleted record, and because a
newer live version applies, a later edit **does** revive it (delete versus edit is
decided by who arrives last, like any other conflict).

**Idempotence.** Replaying a push changes nothing: the unique key makes it an upsert
and the trigger keeps the old `updated_at` when the content is identical. A lost
response therefore costs one redundant request, not a duplicate or a re-stamp.

**Retry.** Network errors set `offline`, other failures set `error`, both retry with
exponential backoff (2 s doubling to a 5 min cap, with jitter). Local edits made
while backing off do not trigger extra requests. An auth error refreshes the
session once and retries immediately. A record the server refuses for good
(constraint violation) is retried alone, then dropped and counted in `rejected`, so
one bad record never blocks the queue.

Status exposed to the UI: `state` is one of `synced | syncing | offline | error`,
plus `pending`, `lastSyncedAt`, `error`, `realtimeConnected`, `rejected` and
`remoteRevision` (a counter that increases when remote data was written locally;
screens watch it to reload).

## Decisions

### (a) Joining when the device already has data

Nothing is merged silently. If the pantry, menu or ticks hold anything,
`joinHousehold` throws `LocalDataDecisionRequired` **before any network call** (the
invite is not consumed) unless the caller passes `localData`:

- `'discard'`: the local data is wiped and replaced with the household's.
- `'upload'`: the household's data is pulled first; then every local record the
  household has **never seen** is queued. On a key collision (both have "milk") the
  **household's version wins**, because the pull overwrites the local one before the
  upload step runs. Documented because it is the safe direction: joining cannot
  clobber what the others already have.

If the device is empty, no decision is needed. The "upload" step is stored as a flag,
so it survives going offline or being killed right after joining.

When a person **creates** a household, their data becomes the household's (nothing
remote can collide), so no choice is asked.

### (b) Leaving a household

`leaveHousehold({ localData: 'keep' | 'discard' })`, default `'keep'`.

1. One last sync cycle is attempted so queued edits are handed over (best effort).
2. Syncing stops, then the server removes **only the caller's membership**. If that
   fails (for example offline) syncing restarts and the error is thrown: the device
   is still in the household and nothing local changed.
3. The outbox, versions and cursors are cleared and the household is forgotten.
   `'keep'` leaves the local tables as they are: the person keeps a **solo snapshot**
   of the shared data. `'discard'` empties them.

The other members keep everything. Edits still queued when step 1 failed are not
carried into solo mode as pending work (they remain in the local copy only). The
last member to leave deletes the household and its data; if the owner leaves, the
longest-standing member becomes owner. Joining another household later goes through
decision (a) again, since the kept snapshot counts as local data.

If the server stops recognising the device (reinstall, lost session, a new
anonymous identity), the next refused write triggers a membership check; when it
fails the device falls back to solo mode with its local copy and the snapshot reports
`membershipLost: true` until dismissed.

## Failure modes

| Situation                                 | Behaviour                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| No network                                | Writes land in SQLite and the outbox; state `offline`; replayed with backoff and on foreground      |
| Supabase down / 5xx                       | State `error`; same retry                                                                           |
| Crash between local write and enqueue     | The edit exists locally but never syncs (a microsecond window). Re-saving the item fixes it         |
| Crash after push, before acknowledge      | Next cycle re-pushes the same rows; idempotent                                                      |
| Realtime channel drops                    | `realtimeConnected = false`; changes arrive on the next pull; reconnect triggers a catch-up pull    |
| Two devices edit the same record          | Whole-record last-write-wins by arrival at the server                                               |
| Row committed late with an older stamp    | The 10 s pull overlap re-reads it; merge is idempotent                                              |
| Phone offline longer than tombstone purge | It can keep a record that was deleted and purged meanwhile (purge is manual and off by default)     |
| Reinstall / cleared data                  | New anonymous identity, not a member any more: rejoin with a new invite. Old membership is orphaned |
| Server rejects a payload                  | Dropped after an isolated retry, counted in `rejected`                                              |
| Sharing env vars missing                  | `isSharingAvailable()` is false; every sharing action throws `unavailable`; nothing else changes    |
| Plan entry amounts (`recipeIngredients`)  | Local-only: no Supabase column. A remote upsert keeps them if the slot holds the same dish, drops them otherwise |
| Web build                                 | Sharing is never available (data is in memory there)                                                |

## Privacy

- No email, phone or name is collected. Identity is a random anonymous Supabase user.
  An optional display name is stored only if the person types one, and members of
  the same household see it.
- The server stores the household's pantry, menu and ticks in clear text (it must,
  to merge and relay them). Anyone with the `service_role`/secret key or database
  access, meaning the project owner, can read them. Members can read all of it and
  can see each other's anonymous user ids.
- Language, preferences and the BFF device id are never uploaded.
- The Gemini key remains on the BFF; sharing adds no secret to the app. The publishable
  key and URL in the bundle are public by design; Row Level Security is the protection.
- Leaving removes the membership but not the records the person contributed: they
  belong to the household. Deleting a household's last member deletes the data.
- The privacy policy and store data-safety forms must be updated before release:
  "user identifiers" and "user content" are now collected, only when sharing is on.

## SQL review notes

Reviewed adversarially by reading every policy, grant, trigger and function. The SQL
was **not executed** against a live Postgres in this phase (no database was available
to the author), so run the checks in `supabase/README.md` after migrating and treat the
first run as the real test.

| Attack                                         | Result                                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Join without a valid invite                    | `household_members` has no INSERT policy or grant; the only writer is `join_household`, which needs an unused, unexpired, unrevoked code (row-locked, single use) |
| Read another household's rows                  | Every table has RLS with `private.is_member(household_id)`. `anon` has no grants. Realtime applies the same policies                                              |
| Remove someone else's membership               | No DELETE grant or policy. `leave_household()` takes no arguments and deletes `user_id = auth.uid()` only                                                         |
| Write into a household you are not in          | INSERT `with check` and UPDATE `using`+`with check` on membership; `household_id` is immutable (trigger)                                                          |
| Tamper with `updated_at` / `updated_by`        | The BEFORE trigger overwrites both on insert and update; the no-op test excludes them, so a forged stamp is ignored                                               |
| Change the key of an existing row              | The guard trigger rejects key column changes                                                                                                                      |
| Read invite codes as a non-member              | `household_invites` select is members only; `join_household` answers `invalid` for unknown, expired, revoked and used codes alike                                 |
| Brute force a code                             | See below                                                                                                                                                         |
| Privilege escalation through definer functions | All use `set search_path = ''`, fully qualified names, no dynamic SQL, typed arguments, caller from `auth.uid()`; `EXECUTE` revoked from `PUBLIC` and `anon`      |
| Call helpers over the API                      | They live in `private`, which is not an exposed schema and has no client grants (except `is_member`, harmless: it only answers about the caller)                  |
| Recursive RLS / policy bypass via `is_member`  | It is `SECURITY DEFINER` reading only `household_members` for `auth.uid()`; no user input is concatenated                                                         |
| Failed attempts not being recorded             | `join_household` returns a status instead of raising, since a raise would roll back the attempt row                                                               |
| Double join / double redeem race               | `FOR UPDATE` on the invite row plus `unique(user_id)`                                                                                                             |
| Last two members leaving at once               | `leave_household` locks the household row first                                                                                                                   |

**Invite entropy and throttling (choice).** 30 symbols x 8 positions is about 39 bits
(6.6e11 codes), drawn from a CSPRNG with rejection sampling (no modulo bias). Codes
live 24 hours and work once. Failed attempts are throttled to 5 per identity per 15
minutes **and** 300 per hour overall. The global cap exists because anonymous
identities are cheap to mint; the per-IP limit on anonymous sign-ins (30/hour by default)
bounds that further. With at most 300 guesses an hour against, say, 100 live codes,
the chance of a hit is about 5e-8 per hour. Trade-off: an attacker who burns the global
budget can block joins for up to an hour (denial of service, no data exposure). Raise
the entropy (10 characters) if that ever matters; the client format is the only change.

**Residual risks, accepted for now:**

- Any member can create and revoke invites; there is no kick or owner-only mode. Trust
  inside a household is symmetric by design.
- A member can write many rows (bounded by column checks and the 10 member cap, not by
  a row quota). Add a trigger-based quota if abuse appears.
- Invite codes are stored in clear text so members can re-display them; a database dump
  exposes the codes that are still valid (at most 24 hours, single use).
- A member's anonymous id is visible to the rest of the household.
- Throttle counters can be exceeded by a handful under heavy concurrency (no lock).
- The secret/`service_role` key bypasses RLS: it must stay out of the app and out of git.
- Anonymous users deleted from the dashboard cascade away their membership; a household
  whose members were all deleted this way is left orphaned (unreachable, harmless).

## Consuming it from the UI (phase 2)

```ts
import { useSharing } from '@/features/household/ui/use-sharing';

const { ready, snapshot, service } = useSharing();
// snapshot: { available, household, membershipLost, sync: SyncStatus }
```

Mount `useSharing()` once near the root (it starts the runtime: restores the
membership, installs the write recorder, starts syncing). Hide the feature when
`snapshot.available` is false. Reload screens when `snapshot.sync.remoteRevision`
changes. The `service` methods are `createHousehold`, `joinHousehold(code,
{ localData, displayName })`, `leaveHousehold({ localData })`, `hasLocalData`,
`createInvite`, `listInvites`, `revokeInvite`, `listMembers`, `dismissMembershipLost`.
Show `formatInviteCode(code)` to people and pass whatever they type to
`joinHousehold` (it normalizes). Ticks are read and written through
`createShoppingChecksRepository()`.

Code map: `features/household/{domain,application,infrastructure,ui}`,
`shared/sync` (entities, outbox store, recorder), `shared/config/sharing.ts`.

## How sharing looks to users

Sharing only exists where it can work: the button and the screen are hidden when
`snapshot.available` is false (no Supabase configuration, and always on web). A
solo user never sees any of it.

**Entry point.** A small people icon sits next to the language button in the Pantry
header. Inside a household a dot on the icon shows the sync state (green synced,
blue syncing, yellow offline, red problem); its accessibility label spells it out,
including how many changes are waiting.

**The Household screen** (`/household`, a modal; code in `features/household/ui`):

- **Not in a household.** An optional "your name", then two cards: _Create a household_
  (a name; the data on the device becomes the household's) and _Join with a code_.
  The code field groups what is typed as `ABCD-EFGH`, ignores case, spaces and
  dashes, and the button stays disabled until all 8 characters are valid.
- **Joining with data already on the device.** If the pantry, menu or ticks are not
  empty the service refuses before touching the network, and the card asks: _Add my
  items to the household_ (the household's version wins on a collision) or _Discard
  mine, use the household's_. Nothing is merged without that answer.
- **In a household.** The household name with the sync state; the members (with
  "You" and "Owner" badges); invite codes (generate, see the active ones with their
  expiry, share, revoke); the last successful sync, the reason when it is failing
  and how many changes the server refused; and _Leave household_.
- **Leaving** asks first and offers _Leave and keep a copy_ (default for the data:
  the person keeps a solo snapshot) or _Leave and delete my copy_.
- **Membership lost.** If the server stops recognising the device, a banner explains
  that the items stay as a personal copy; dismissing it clears the notice.
- **Errors** are translated per case: every refused-invite reason (`invalid`,
  `throttled`, `already_member`, `full`) and every `SharingError` kind. Internal
  messages never reach the screen.

**Invite codes are shared through the system share sheet**, which on both platforms
also offers Copy. There is no dedicated Copy button because the app has no clipboard
module and this phase adds no dependency; the code is also selectable text (long
press).

**Live data.** The pantry, menu and shopping list reload by themselves when
`remoteRevision` changes. Shopping ticks now go through the shared checks repository,
so a tick made on one phone appears on the other. In solo mode this also means ticks
now survive restarting the app on native builds (before they were session-only).

**Mounting.** `SharingProvider` (`features/household/ui/sharing-provider.tsx`) calls
`useSharing()` once under `I18nProvider` in the root layout and shares the result
through context (`useSharingContext`, `useRemoteRevision`). It never blocks the first
render: until the runtime is ready the context reports "not ready", and without a
provider it reports "not available".
