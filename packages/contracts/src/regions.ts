/**
 * Regions the menu planner can tailor dishes to.
 *
 * Shared because the region travels with the plan request and the BFF turns it
 * into prompt guidance. To add one: append its code here, then the compiler
 * points at every record that needs an entry (the BFF profile, the app labels).
 */
export const REGIONS = ['CO'] as const;

export type Region = (typeof REGIONS)[number];

/** What a request or a stored setting without a region gets. */
export const DEFAULT_REGION: Region = 'CO';

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value);
}
