# Domain model

The vocabulary below is the one the code uses. If a concept is not named here,
it does not belong in `domain/` yet.

## Entities and value objects

### Ingredient
A kind of food, independent of how much of it we own.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `IngredientId` | |
| `name` | `string` | Normalized for matching: lowercased, whitespace collapsed, accents stripped |
| `displayName` | `string` | What the user typed, kept for display |
| `category` | `IngredientCategory` | produce, dairy, meat, grain, spice, other |
| `defaultUnit` | `Unit` | |

Normalization deliberately does NOT convert plurals to singular. Doing that
correctly needs per-language rules, and a naive suffix strip mangles words like
"arroz". Plural handling belongs in a lookup table and is deferred until
matching quality actually demands it.

The eñe is preserved rather than folded into `n`: in Spanish it is a distinct
letter, and folding it would merge words that are genuinely different.

### Quantity (value object)
`{ amount: number, unit: Unit }`

Units are not interchangeable by accident. Conversion is an explicit domain
operation and fails loudly when undefined (you cannot convert grams to units of
egg without a density rule).

### PantryItem
An `Ingredient` we actually have, and how much.

| Field | Type | Notes |
| --- | --- | --- |
| `ingredientId` | `IngredientId` | |
| `quantity` | `Quantity` | |
| `lowStockThreshold` | `Quantity \| null` | Drives the low-stock alert |
| `expiresAt` | `Date \| null` | Used to prioritize suggestions |

Rule: `isLowStock()` is true when a threshold exists and `quantity` is at or
below it. It lives on the entity, not in a screen.

### Recipe
| Field | Type |
| --- | --- |
| `id` | `RecipeId` |
| `title` | `string` |
| `servings` | `number` |
| `ingredients` | `RecipeIngredient[]` |
| `steps` | `string[]` |
| `timeMinutes` | `number` |
| `difficulty` | `easy \| medium \| hard` |

### RecipeIngredient
`{ name: string, quantity: Quantity, optional: boolean }`

Kept as a name rather than an `IngredientId`, because a generated recipe may
reference food we have never registered. Matching against the pantry is a
domain service, not a foreign key.

### DishSuggestion
What comes back from the suggestion port before the user commits to a recipe.

`{ title, summary, matchedIngredients, missingIngredients, coverage, mode }`

`coverage` is the fraction of required ingredients already in the pantry. This
is what lets the UI sort "you can cook this right now" above "you are two
things short".

In `strict` mode a surviving suggestion always has `coverage === 1` and an
empty `missingIngredients`. If it does not, it never should have reached the
app - see `EnforceSuggestionMode` below.

### SuggestionMode
How much freedom Gemini has when proposing dishes.

| Mode | Meaning |
| --- | --- |
| `strict` | Only ingredients registered in the pantry, plus the staples list |
| `flexible` | May introduce ingredients the user does not have, within a limit |

This is a user-facing toggle, not a hidden setting. Both modes are first-class:
`strict` answers "what can I cook right now", `flexible` answers "what is worth
buying two things for".

### PantryStaple
Basics assumed to always be available, so `strict` mode stays usable.

`{ name: string, enabled: boolean }`

Defaults: water, salt, pepper, cooking oil. Editable by the user, because the
assumption is wrong for someone who genuinely ran out of oil.

Without this list, `strict` mode rejects nearly every real recipe and the
feature is dead on arrival.

### Preferences

| Field | Type | Notes |
| --- | --- | --- |
| `suggestionMode` | `SuggestionMode` | Defaults to `strict` |
| `maxMissingIngredients` | `number` | Only meaningful in `flexible`; defaults to 3 |
| `staples` | `PantryStaple[]` | |
| `dietary` | `string[]` | Vegetarian, gluten-free, allergies |
| `dislikes` | `string[]` | Ingredients to avoid entirely |

`dislikes` is enforced the same way as `strict` mode: asked for in the prompt,
verified deterministically afterwards. An allergy is not something to leave to
a model's good intentions.

### MealPlan / MealPlanEntry
A `MealPlan` covers one week: `{ weekStartDate, entries }`.
An entry is `{ date, slot, recipeId }` where `slot` is breakfast, lunch, or
dinner.

### ShoppingListItem
Derived, never stored as truth: `{ ingredientName, neededQuantity, reason }`,
where `reason` is either `low-stock` or `missing-for-plan`.

## Use cases

### Pantry
- `AddPantryItem`
- `UpdatePantryQuantity`
- `RemovePantryItem`
- `ListPantry`
- `ListLowStockItems`

### Recipes
- `SuggestDishesFromPantry` - sends pantry contents and `Preferences` through
  `RecipeSuggestionService`, returns `DishSuggestion[]` sorted by coverage
- `GetRecipeDetail` - full recipe for a chosen suggestion
- `MatchRecipeAgainstPantry` - domain service producing matched / missing sets
- `EnforceSuggestionMode` - domain service that takes raw suggestions and the
  active `Preferences`, and returns only the ones that actually comply

`EnforceSuggestionMode` is the load-bearing piece of this feature. Rules:

| Mode | A suggestion is kept when |
| --- | --- |
| `strict` | Every non-optional ingredient is in the pantry or in `staples` |
| `flexible` | `missingIngredients.length <= maxMissingIngredients` |
| both | No ingredient matches `dislikes` |

It is a pure function over data, which is exactly why it is testable and why it
lives in `domain` rather than in the screen or the prompt.

### Meal plan
- `GenerateWeeklyMenu` - proposes a week from pantry, preferences, and variety rules
- `AssignRecipeToSlot`
- `ClearSlot`
- `GetWeeklyMenu`

### Shopping
- `BuildShoppingList` - union of low-stock items and ingredients missing for
  the current week's plan

## Ports

```ts
interface PantryRepository {
  findAll(): Promise<PantryItem[]>
  save(item: PantryItem): Promise<void>
  remove(id: IngredientId): Promise<void>
}

interface RecipeSuggestionService {
  suggest(pantry: PantryItem[], prefs: Preferences): Promise<DishSuggestion[]>
  detail(suggestion: DishSuggestion): Promise<Recipe>
  weeklyMenu(pantry: PantryItem[], prefs: Preferences): Promise<MealPlan>
}

interface MealPlanRepository {
  findByWeek(weekStartDate: Date): Promise<MealPlan | null>
  save(plan: MealPlan): Promise<void>
}

interface NotificationScheduler {
  scheduleLowStockCheck(at: Date): Promise<void>
  cancelAll(): Promise<void>
}
```

## Screens

| Route | Purpose |
| --- | --- |
| `(tabs)/pantry` | Inventory list, quick quantity edit, low-stock badges |
| `(tabs)/discover` | Suggestions from current pantry, with the strict / flexible toggle |
| `(tabs)/menu` | Weekly grid, drag a suggestion into a slot |
| `(tabs)/shopping` | Generated shopping list |
| `recipe/[id]` | Full recipe: ingredients, steps, what you are missing |
| `pantry/add` | Add or edit a pantry item |

## A note on generated content

Everything returned by the model is untrusted input. It is schema-validated at
the BFF boundary and treated as data in the app - never rendered as markup,
never used to build a query, never trusted for quantities without range checks.

This extends to the suggestion mode. A prompt asking for pantry-only recipes
expresses an intent, not a guarantee: models routinely add salt, oil, or a
clove of garlic that was never registered. `strict` mode is therefore enforced
by `EnforceSuggestionMode` after the response arrives, never by the wording of
the request. The same applies to `dislikes` and dietary restrictions.
