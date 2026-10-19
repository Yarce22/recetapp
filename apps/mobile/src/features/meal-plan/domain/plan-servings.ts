/**
 * How many servings a planned dish is shopped and shown for.
 *
 * Plan entries keep their ingredient amounts per serving, so something has to
 * say how many. The app has no household-size setting yet; until it does, the
 * shopping list and the recipe screen both use this one number so they never
 * disagree about how much to buy.
 */
export const PLAN_SERVINGS = 2;
