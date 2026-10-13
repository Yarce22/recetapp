import { createTranslator, type Translator } from '@/shared/i18n/translator';

import type { Quantity } from '../domain/quantity';

/**
 * Formats a quantity for display.
 *
 * Trailing zeros are dropped so a whole amount reads "500 g" rather than
 * "500.000000 g". The unit name and the decimal separator follow the language;
 * the quantity itself is stored with the English unit identifier.
 */
export function formatQuantity(
  quantity: Pick<Quantity, 'amount' | 'unit'>,
  translator: Pick<Translator, 't' | 'formatNumber'> = createTranslator('en'),
): string {
  const amount = Number(quantity.amount.toFixed(2));
  return `${translator.formatNumber(amount)} ${translator.t(`unit.${quantity.unit}`)}`;
}
