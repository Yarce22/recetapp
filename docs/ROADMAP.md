# Roadmap

Phases are ordered so that each one ends with something runnable on a real
device. Strict TDD applies from Phase 1: domain and use cases get a failing
test before an implementation exists.

## Phase 0 - Foundations [done]

- Monorepo workspaces, TypeScript config, ESLint, Prettier
- Expo app boots with Expo Router and the tab skeleton
- Test runner wired: Jest + `@testing-library/react-native`
- Path aliases so `features/*` and `shared/*` import cleanly

Done when: the app opens on a device, tabs navigate, one trivial test passes.

## Phase 1 - Pantry (no AI yet) [done]

- `Ingredient`, `Quantity`, `PantryItem` with their rules, test-first
- SQLite schema and migration runner
- `PantryRepository` SQLite adapter
- Add / edit / remove / list use cases
- Pantry screen and add-item form

Done when: you can register what is in your kitchen and it survives a restart.

This phase deliberately contains no Gemini call. If the pantry is not solid,
the suggestions built on it cannot be.

## Phase 2 - BFF and first suggestions [done]

- `apps/api` with `POST /suggestions`, `GEMINI_API_KEY` server-side only
- Schema validation of model output, rejecting malformed responses
- Rate limiting per device identifier plus a global quota
- `EnforceSuggestionMode` domain service, test-first, covering strict, flexible
  and dislikes
- `RecipeSuggestionService` HTTP adapter in the app
- Discover screen: suggestions sorted by coverage, with the strict / flexible
  toggle and an editable staples list

Done when: your real pantry produces dishes you could actually cook tonight,
and strict mode never proposes something you do not have.

The mode filter is written test-first with fixtures of deliberately
non-compliant model responses. It is the only thing standing between the
feature and a model that improvises ingredients.

## Phase 3 - Recipe detail [done]

- `POST /recipes/:id` returning full steps and quantities
- Recipe screen showing ingredients, steps, and what you are missing
- Scale quantities by servings

## Phase 4 - Weekly menu

- `MealPlan` domain and repository
- `POST /meal-plan` for a proposed week, with variety rules
- Weekly grid, assign and clear slots
- Regenerate a single day without losing the rest

## Phase 5 - Low stock and shopping list

- `lowStockThreshold` per pantry item
- `ListLowStockItems` and `BuildShoppingList`
- `expo-notifications` for the low-stock alert
- Shopping screen combining low stock and what the week's plan requires

## Phase 6 - Ship

- App icon, splash, store metadata
- EAS Build profiles for development, preview, production
- `eas submit` to Play Store and App Store
- `expo-updates` configured for OTA on the JS layer

## Explicitly out of scope for the MVP

These are deferred on purpose, not forgotten:

- Accounts and multi-device sync
- Barcode scanning to add items
- Photo recognition of the fridge
- Nutritional data
- Sharing recipes between users

## Known risks

| Risk | Mitigation |
| --- | --- |
| Model invents impossible quantities | Range checks and schema validation at the BFF |
| Model ignores strict mode and adds ingredients | `EnforceSuggestionMode` filters server-side; the prompt is never the enforcement |
| Strict mode returns almost nothing | Staples list, one tightened retry, honest empty state |
| Gemini cost grows with usage | Per-device rate limit, global quota, cache repeated pantry sets |
| Ingredient name matching is fuzzy | Normalize on write, keep matching a testable domain service |
| No accounts weakens abuse control | Accepted for MVP; revisit if quota abuse appears |
