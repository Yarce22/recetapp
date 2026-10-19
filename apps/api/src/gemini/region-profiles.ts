import type { Region } from '@recetapp/contracts';

export type RegionProfile = {
  /** Name used in the prompt. */
  name: string;
  /** Guidance appended to the planning prompt, one instruction per line. */
  guidance: string[];
};

/**
 * What the model should assume about each supported region.
 *
 * A `Record` over `Region`, so adding a region to the shared list is a compile
 * error here until its profile is written.
 */
export const REGION_PROFILES: Record<Region, RegionProfile> = {
  CO: {
    name: 'Colombia',
    guidance: [
      'Prefer dishes typical of Colombian home cooking (for example arepas, sancocho, bandeja paisa, ajiaco, arroz con pollo, calentado, changua) and everyday dishes made with ingredients easy to find in Colombian markets and supermarkets.',
      'Use the ingredient names Colombians use at the market (for example "papa" rather than "patata", "platano maduro", "habichuela", "mazorca", "panela", "aji dulce").',
      'Use the metric system for amounts (g, kg, ml, l). Meals follow local habits: a light breakfast, a substantial lunch, a lighter dinner.',
    ],
  },
};
