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

## Status

Planning and scaffolding. No application code yet.
