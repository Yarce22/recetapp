# Architecture

## 1. The decision that shapes everything: the Gemini API key

A published mobile app is not a trusted environment. An `.aab` or `.ipa` can be
unpacked with public tooling, and every string compiled into the bundle comes
out with it - including anything named `EXPO_PUBLIC_*`. Gemini is billed per
use, so a leaked key is someone else's usage on our bill.

Therefore the mobile app never holds the key.

```
Mobile app  ──HTTPS──▶  BFF (our backend)  ──HTTPS──▶  Gemini API
                         holds GEMINI_API_KEY
```

What the BFF buys us beyond key safety:

- Rate limiting and quotas per device, so one client cannot drain the budget
- Prompt and model changes without shipping a new app build
- Response caching for repeated pantry combinations
- A single place to validate and shape model output before it reaches the app

## 2. Local-first data

The pantry, the weekly menu, and the shopping list live in SQLite on the
device (`expo-sqlite`). The BFF is stateless: it proxies Gemini and nothing
else.

Rationale:

- A cooking app is used in a kitchen, sometimes without signal
- No sign-up wall in the MVP, which is the main onboarding drop-off
- Personal inventory data never leaves the device except as prompt content

Trade-off accepted: no multi-device sync in the MVP. Because persistence sits
behind a repository port (section 4), adding a remote sync adapter later does
not require touching features.

Consequence to handle: with no accounts, abuse control on the BFF is based on
an anonymous device identifier plus a server-side global quota. This is weaker
than authenticated quotas and is a deliberate MVP trade-off.

## 3. Layers and the dependency rule

Clean / Hexagonal, with folders that name the domain rather than the framework
(Screaming Architecture).

```
        ui  ─────────▶  application  ─────────▶  domain
        │                    │                     ▲
        │                    ▼                     │
        └──────────▶  infrastructure  ─────────────┘
```

The dependency rule: source code dependencies point inward only.

| Layer | Contains | May import |
| --- | --- | --- |
| `domain` | Entities, value objects, port interfaces, domain rules | Nothing outside itself |
| `application` | Use cases orchestrating the domain | `domain` |
| `infrastructure` | Port implementations: SQLite, HTTP, notifications | `domain`, `application` |
| `ui` | Screens, components, hooks | `application`, `domain` |

`domain` must not import React, Expo, SQLite, or fetch. If it does, the
boundary has already been broken.

## 4. Ports and adapters

Ports are interfaces declared in `domain`. Adapters implement them in
`infrastructure`. Use cases depend on the port, never on the adapter.

| Port | MVP adapter | Swappable to |
| --- | --- | --- |
| `PantryRepository` | SQLite (`expo-sqlite`) | Remote sync adapter |
| `RecipeSuggestionService` | HTTP call to our BFF | Direct SDK, or a different model |
| `MealPlanRepository` | SQLite | Remote sync adapter |
| `NotificationScheduler` | `expo-notifications` | Any push provider |

This is what makes the key decision in section 1 reversible in practice: the
app talks to `RecipeSuggestionService`, not to Gemini.

## 5. Mobile folder structure

```
apps/mobile/src/
├── app/                      Expo Router routes - thin, route wiring only
│   ├── (tabs)/
│   │   ├── pantry.tsx
│   │   ├── discover.tsx
│   │   ├── menu.tsx
│   │   └── shopping.tsx
│   └── recipe/[id].tsx
├── features/
│   ├── pantry/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── ui/
│   ├── recipes/
│   ├── meal-plan/
│   └── shopping-list/
└── shared/
    ├── ui/                   Design system - atoms, molecules, organisms
    ├── db/                   SQLite client, migrations
    ├── http/                 BFF client
    └── config/
```

Routes under `app/` stay thin on purpose: they resolve params and render a
container from the matching feature. Navigation is a delivery detail, not a
place for logic.

Inside `ui/`, components follow the container / presentational split.
Presentational components receive data and callbacks as props and hold no
knowledge of use cases, which is what keeps them testable and reusable.

## 6. Backend (BFF) structure

```
apps/api/src/
├── routes/          HTTP handlers
├── gemini/          Model client, prompt construction, response parsing
├── policy/          Rate limiting, quotas, input validation
└── config/          Environment loading - GEMINI_API_KEY lives here
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/suggestions` | Pantry contents plus preferences in, compliant dishes out |
| `POST` | `/recipes/:id` | Full recipe for a chosen dish |
| `POST` | `/meal-plan` | Weekly menu proposal from pantry and preferences |

Model output is validated against a schema at the BFF boundary before it is
returned. An LLM response is untrusted input: it is parsed and checked, never
passed through to the client as-is.

## 7. Enforcing the suggestion mode

The app offers two ways to ask for dishes:

- `strict` - only what is registered in the pantry, plus the staples list
- `flexible` - Gemini may introduce ingredients the user would have to buy

The important part is not the prompt. It is that the prompt is not trusted.

```
prompt asks  ──▶  Gemini responds  ──▶  schema validation  ──▶  EnforceSuggestionMode
   intent                                  shape is valid          rules are satisfied
```

A language model given "use only these ingredients" complies most of the time
and then quietly adds olive oil. That is a tendency, not a contract. So the BFF
re-checks every returned ingredient against the pantry and the staples list, and
drops any suggestion that violates the active mode before it is serialized back
to the app.

Consequences that have to be designed for, not discovered later:

| Situation | Handling |
| --- | --- |
| Strict filtering leaves too few dishes | Retry once with a tightened prompt, then return what survived with an honest empty state |
| Model returns a dish with an unregistered staple | Kept if the staple is enabled, dropped otherwise |
| Model ignores a dietary restriction or dislike | Dropped unconditionally - allergies are never left to the model |

Filtering runs on the BFF rather than on the device for two reasons: a rejected
suggestion should not consume the user's bandwidth or battery, and a retry can
happen server-side without a round trip. `EnforceSuggestionMode` itself is a
pure function shared through `packages/contracts`, so the app can re-apply it
defensively without duplicating the rules.

## 8. Shared contracts

`packages/contracts` holds the request and response types for the endpoints
above, imported by both `apps/mobile` and `apps/api`. One definition, so a
backend change that breaks the app fails at compile time rather than at
runtime on a user's phone.
