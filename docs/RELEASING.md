# Releasing

Everything here that can be configuration is already in the repository:
`apps/mobile/app.json` and `apps/mobile/eas.json`. What remains needs accounts
and credentials that belong to you, so it is written out rather than scripted.

## What you need before the first build

|                         | Cost                | Needed for                                          |
| ----------------------- | ------------------- | --------------------------------------------------- |
| Expo account            | Free tier available | EAS Build, EAS Submit, OTA updates                  |
| Apple Developer Program | USD 99 / year       | App Store                                           |
| Google Play Console     | USD 25, once        | Play Store                                          |
| A deployed BFF          | Depends on host     | The app is useless without it                       |
| A privacy policy URL    | -                   | Required by both stores. See the disclosure section |

Android alone is the cheaper way to start: USD 25 once, and no annual renewal.

## One-time setup

```bash
npm install -g eas-cli
cd apps/mobile
eas login
eas init                 # creates the EAS project and writes its id into app.json
eas update:configure     # adds the updates.url that OTA needs
```

`eas init` is what fills in the project id. Until it runs, `expo config` shows
`updates: null`, which is expected rather than broken.

Credentials (signing keys, provisioning profiles) are generated and stored by
EAS on the first build of each platform. Let it manage them unless you already
have keys you must keep.

## The three build profiles

| Profile       | What it is for                                   | Notes                                               |
| ------------- | ------------------------------------------------ | --------------------------------------------------- |
| `development` | A dev client you install once and point at Metro | Talks to `localhost:8787`                           |
| `preview`     | A shareable build for testers                    | Android comes out as an APK so it installs directly |
| `production`  | What goes to the stores                          | Version code and build number auto-increment        |

```bash
eas build --profile preview --platform android
eas build --profile production --platform all
```

`appVersionSource` is set to `remote`, so EAS owns the build numbers. Do not
also bump them by hand: two sources for one number is how a submission gets
rejected for reusing a version.

## Pointing the app at a real backend

`EXPO_PUBLIC_API_URL` is set per profile in `eas.json`, and currently points at
`https://recetapp-api.example.com` in `preview` and `production`. **Change it to
the real host before building anything you intend to ship**, or the app will
reach nothing.

That variable is compiled into the bundle and readable by anyone who unpacks
it. That is fine for a base URL, and it is exactly why the Gemini key is not
kept there. See [the architecture](ARCHITECTURE.md).

## Submitting

```bash
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

The first submission of each platform still has to be done through App Store
Connect and the Play Console by hand: the listing, the screenshots, the
content rating questionnaire and the privacy disclosures below cannot be
scripted. After that, `eas submit` uploads each new build.

## OTA updates, and their limit

```bash
eas update --channel production --message "Fix the low-stock wording"
```

This reaches installed apps in minutes without a store review. It only carries
the JavaScript layer.

`runtimeVersion` is set to the `fingerprint` policy, which changes whenever the
native side does. That is the safety mechanism: an OTA update built against
different native modules simply will not be offered to an older build, instead
of being delivered and crashing on launch. Adding a native dependency means a
new store build, not an update.

## Privacy disclosures - do not skip this

Both stores require you to declare what the app collects, and this app does
collect something:

- **Ingredient names the user types.** They are sent to the BFF and forwarded
  to Google's Gemini API to generate suggestions and recipes. That is user
  content leaving the device and reaching a third party.
- **An anonymous per-install identifier.** Generated on the device, sent as
  `x-device-id`, used only to spread the rate limit across clients. It
  identifies a copy of the app, not a person.

What that means concretely:

- **Apple**: the Privacy Nutrition Label must declare "Other User Content" and
  a device identifier, and say whether they are linked to the user. Neither is
  linked to an account here, because there are no accounts.
- **Google**: the Data Safety form must declare the same, mark the data as
  shared with a third party, and confirm it is encrypted in transit. It is -
  everything goes over HTTPS.
- **Both**: a reachable privacy policy URL is mandatory. It has to name Google
  as the processor of the ingredient text.

The pantry itself, the weekly plan and the preferences never leave the device,
which is the local-first decision recorded in
[the architecture](ARCHITECTURE.md). Only the ingredient names needed for a
request are sent, and nothing is stored on the server.

## The app icon and splash

The mark is a pantry jar: the thing that makes this app different from a
recipe book is that it starts from what you already have.

`apps/mobile/assets/brand/*.svg` is the editable source. The PNGs the stores
actually consume live in `assets/images/` and are build output, regenerated by:

```bash
cd apps/mobile
node scripts/generate-brand-assets.mjs
```

Both are committed, because EAS Build never runs that script. Rasterizing pulls
`sharp` through `npx`, so it is not a dependency of the app.

Three constraints are baked into the script rather than left to be remembered:

| Constraint                                          | Why                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `icon.png` is flattened to remove its alpha channel | App Store Connect rejects an icon that has one                    |
| Android layers shrink to the central 66/108 circle  | That is the only region every launcher mask is guaranteed to show |
| The monochrome layer drops the jar's contents       | Android tints it flat, so the fill would merge into the wall      |

`__tests__/app-icons.test.ts` enforces all of it, along with the rule that
`app.json` never points back at Expo's template icon bundle.

## Still missing before a real submission

- Store screenshots, on the device sizes each store demands.
- The listing copy in [`store/`](../store), which is a draft and not final text.
- A deployed BFF with a real `GEMINI_API_KEY`, and `EXPO_PUBLIC_API_URL`
  pointing at it.
