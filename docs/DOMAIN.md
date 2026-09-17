# Domain model

The vocabulary below is the one the code uses. If a concept is not named here,
it does not belong in `domain/` yet.

## Entities and value objects

### Ingredient
A kind of food, independent of how much of it we own.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `IngredientId` | |
| `name` | `string` | Normalized for matching ("tomato", not "Tomatoes") |
| `category` | `IngredientCategory` | produce, dairy, meat, grain, spice, other |
| `defaultUnit` | `Unit` | |

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

`{ title, summary, matchedIngredients, missingIngredients, coverage }`

`coverage` is the fraction of required ingredients already in the pantry. This
is what lets the UI sort "you can cook this right now" above "you are two
things short".

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
- `SuggestDishesFromPantry` - sends pantry contents through
  `RecipeSuggestionService`, returns `DishSuggestion[]` sorted by coverage
- `GetRecipeDetail` - full recipe for a chosen suggestion
- `MatchRecipeAgainstPantry` - domain service producing matched / missing sets

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
| `(tabs)/discover` | Dish suggestions from current pantry, sorted by coverage |
| `(tabs)/menu` | Weekly grid, drag a suggestion into a slot |
| `(tabs)/shopping` | Generated shopping list |
| `recipe/[id]` | Full recipe: ingredients, steps, what you are missing |
| `pantry/add` | Add or edit a pantry item |

## A note on generated content

Everything returned by the model is untrusted input. It is schema-validated at
the BFF boundary and treated as data in the app - never rendered as markup,
never used to build a query, never trusted for quantities without range checks.
