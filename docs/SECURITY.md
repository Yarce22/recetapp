# Security notes

## Dependency advisories

`npm audit` reports 3 moderate advisories. They are one root cause propagating
through two wrappers, and it cannot be fixed from this repository. This file
records why, so nobody has to re-derive it.

Run `npm audit` and expect exactly this. A new entry means something changed
and is worth reading.

### Open: decode-uri-component denial of service

|          |                                                                          |
| -------- | ------------------------------------------------------------------------ |
| Advisory | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| Severity | Moderate                                                                 |
| Path     | `expo-router` -> `query-string@7.1.3` -> `decode-uri-component@0.2.2`    |
| Fixed in | `decode-uri-component@0.5.0`                                             |
| Status   | Cannot be fixed here                                                     |

**Why it cannot be fixed.** The patched release is ESM only (`"type":
"module"`). `query-string@7.1.3` loads it with `require()`, which under 0.5.0
returns `{ __esModule, default }` rather than a function. Forcing the upgrade
through an npm override was tried and verified to break `query-string.parse()`
outright, which is what `expo-router` uses to read URLs - the app's routing
stops working. No release of `decode-uri-component` is both patched and
CommonJS: 0.4.1 and everything below it are in the vulnerable range.

The fix has to come from Expo bumping the `query-string` dependency inside
`expo-router`. Re-check when the SDK updates.

**What the exposure actually is.** Malformed percent-encoded input makes the
decoder take exponential time. It is reachable through URL parsing, so in
practice: someone persuades the user to open a crafted `recetapp://` deep link
and the app hangs. No code execution, no data exposure, and it affects only the
device that opened the link. That is a real bug and a small one.

### Fixed: uuid missing buffer bounds check

|          |                                                                          |
| -------- | ------------------------------------------------------------------------ |
| Advisory | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| Path     | `@expo/config-plugins` -> `xcode` -> `uuid@7.0.3`                        |
| Fix      | npm override pinning `uuid` to `^11.1.1` inside `xcode`                  |

This one upgraded cleanly. `uuid@11` still ships a CommonJS build, `xcode` only
calls `uuid.v4()`, and both were verified to load and work after the change.
That single override removed 11 of the 14 reported advisories, since most of
them were `@expo/*` packages inheriting this one.

## Things npm suggests that must not be run

`npm audit fix --force` proposes downgrading `expo` to **46.0.21** and
`expo-router` to **5.1.11**. This project is on SDK **57**. The resolver is
reading advisory ranges that do not line up with Expo's SDK-aligned versioning,
and following it would take the project back eleven major versions.

Fix advisories with targeted `overrides` and verify the result, or record them
here. Never with `--force`.

## Applying an override

npm reconciles against the existing tree and will silently ignore a newly added
`overrides` block on a normal `npm install`. To actually apply one:

```bash
rm -rf node_modules package-lock.json
npm install
```

Then verify the package still behaves, not just that the version changed. The
`decode-uri-component` attempt above passed `npm audit` and broke the app.

## Where the Gemini key lives

Only on the server, in `apps/api/.env`. It is never sent to the app and never
compiled into a bundle - see [the architecture](ARCHITECTURE.md) for why, and
`apps/api/.env.example` for the variables. The BFF refuses to start without it.
