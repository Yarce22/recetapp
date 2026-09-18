# RecetApp

Mobile app that turns what you already have at home into something to cook.

You register the ingredients in your pantry, and the app proposes dishes you can
actually make with them, gives you the full recipe, helps you lay out a weekly
menu, and warns you when an ingredient is running low.

## Stack

| Layer | Choice |
| --- | --- |
| Mobile | Expo (React Native) + TypeScript |
| Routing | Expo Router (file-based) |
| Local storage | SQLite via `expo-sqlite` (local-first) |
| AI | Google Gemini, reached through our own backend |
| Backend | Stateless BFF that proxies Gemini (never ships the API key) |
| Builds | EAS Build -> real `.aab` / `.ipa` for Play Store and App Store |

## Repository layout

```
recetapp/
├── apps/
│   ├── mobile/      Expo application
│   └── api/         BFF - Gemini proxy, stateless
├── packages/
│   └── contracts/   Request/response types shared by mobile and api
└── docs/            Architecture, domain model, roadmap
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - layers, boundaries, and why the API key lives server-side
- [Domain model](docs/DOMAIN.md) - entities, use cases, and ports
- [Roadmap](docs/ROADMAP.md) - delivery phases

## Working locally

```bash
npm install          # once, from the repo root
npm run mobile       # Expo dev server
npm run api          # BFF, needs apps/api/.env
```

The BFF holds the Gemini key. Copy `apps/api/.env.example` to
`apps/api/.env` and put a Google AI Studio key in it; the server refuses to
start without one, on purpose.

On a physical device `localhost` is the phone, not your machine, so point the
app at your machine instead:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:8787 npm run mobile
```

From `apps/mobile` you also have `npm run typecheck`, `npm test` and
`npm run lint`.

### Running on web

The web target runs, but it does not persist anything: reloading the page
starts from an empty pantry.

`expo-sqlite` reaches web through a WebAssembly build that ships as a web
worker, and Expo's chunk serializer could not produce a standalone chunk for
that worker in this project - every web bundle failed with
`Worker chunk not found for: expo-sqlite/web/worker.ts`.

Rather than patch the bundler, the repository port is satisfied with a
different adapter on web. `create-pantry-repository.web.ts` returns the
in-memory repository, so expo-sqlite never enters the web bundle at all.
Native keeps its SQLite storage untouched.

This is what the ports in [the architecture](docs/ARCHITECTURE.md) are for. If
web ever becomes worth persisting, the replacement is an IndexedDB adapter
behind that same function, and no feature code changes.

## Status

Phases 0 to 2 complete: pantry storage, the Gemini-backed BFF, and the
Discover screen with strict and flexible suggestions. See [the roadmap](docs/ROADMAP.md) for what comes next.
