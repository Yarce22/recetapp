import type { Language } from '@recetapp/contracts';

import { en, type MessageKey } from './messages/en';
import { es } from './messages/es';

export type { MessageKey };

export type Catalog = Record<MessageKey, string>;

export const catalogs: Record<Language, Catalog> = { en, es };

type PluralBase<K> = K extends `${infer Base}_other` ? Base : never;
type PlainKey<K> = K extends `${string}_one` | `${string}_other` ? never : K;

/**
 * What callers pass to `t`: a plain key, or the base of a plural pair.
 *
 * `menu.unfilled_one` and `menu.unfilled_other` are requested together as
 * `menu.unfilled` with a `count`, so the singular and plural forms cannot be
 * picked by hand and drift from the number they describe.
 */
export type TranslationKey = PlainKey<MessageKey> | PluralBase<MessageKey>;
