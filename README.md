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
npm run mobile       # starts the Expo dev server
```

From `apps/mobile` you also have `npm run typecheck`, `npm test` and
`npm run lint`.

### Running on web

The web target works, but it needs two things that `metro.config.js` already
sets up: `.wasm` registered as an asset extension, because `expo-sqlite` runs
on web through a WebAssembly build of SQLite, and the
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers, because
that build needs `SharedArrayBuffer` and browsers only expose it to
cross-origin isolated documents.

If the web bundle ever fails with `Unable to resolve module
./wa-sqlite/wa-sqlite.wasm`, that configuration is what went missing. Restart
the dev server with `--clear` after changing `metro.config.js`: Metro caches
the resolver and will keep reporting the old error otherwise.

### A note on OneDrive

This repository currently lives inside a OneDrive folder. `node_modules`
contains tens of thousands of small files, and syncing them causes slow
installs, file locks during builds, and occasional corrupted packages that look
like random build failures. Moving the repository outside OneDrive is the
durable fix.

## Status

Phase 0 complete: the app boots with four tabs, typecheck is clean and the
test runner is wired. See [the roadmap](docs/ROADMAP.md) for what comes next.
