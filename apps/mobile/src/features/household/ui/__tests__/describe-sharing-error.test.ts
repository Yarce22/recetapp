import { createTranslator } from '@/shared/i18n/translator';

import { InviteRejectedError, SharingError, type SharingErrorKind } from '../../domain/household';
import { describeSharingError } from '../describe-sharing-error';

const en = createTranslator('en').t;
const es = createTranslator('es').t;

describe('describeSharingError', () => {
  it.each([
    ['invalid', 'That code is not valid. It may have expired or been used.'],
    ['throttled', 'Too many attempts. Wait a few minutes and try again.'],
    ['already_member', 'You are already in a household.'],
    ['full', 'That household is full.'],
  ] as const)('explains a refused invite (%s)', (reason, message) => {
    expect(describeSharingError(new InviteRejectedError(reason), en)).toBe(message);
  });

  it.each<SharingErrorKind>(['offline', 'auth', 'forbidden', 'rejected', 'server', 'unavailable'])(
    'has a sentence for the %s kind, in both languages',
    (kind) => {
      const error = new SharingError(kind, 'internal detail');

      const english = describeSharingError(error, en);
      const spanish = describeSharingError(error, es);

      expect(english).not.toContain('household.error');
      expect(spanish).not.toContain('household.error');
      expect(english).not.toBe(spanish);
      expect(english).not.toContain('internal detail');
    },
  );

  it('falls back to a generic sentence for anything else', () => {
    expect(describeSharingError(new Error('boom'), en)).toBe('Something went wrong. Try again.');
    expect(describeSharingError('weird', es)).toBe('Algo salió mal. Inténtalo de nuevo.');
  });
});
