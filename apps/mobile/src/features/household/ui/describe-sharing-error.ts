import type { TranslationKey } from '@/shared/i18n/catalog';
import type { Translate } from '@/shared/i18n/translator';

import {
  InviteRejectedError,
  SharingError,
  type JoinResult,
  type SharingErrorKind,
} from '../domain/household';

const INVITE_MESSAGES: Record<Exclude<JoinResult['status'], 'ok'>, TranslationKey> = {
  invalid: 'household.error.invite.invalid',
  throttled: 'household.error.invite.throttled',
  already_member: 'household.error.invite.already_member',
  full: 'household.error.invite.full',
};

const KIND_MESSAGES: Record<SharingErrorKind, TranslationKey> = {
  offline: 'household.error.offline',
  auth: 'household.error.auth',
  forbidden: 'household.error.forbidden',
  rejected: 'household.error.rejected',
  server: 'household.error.server',
  unavailable: 'household.error.unavailable',
};

/** The kind of a failed sync cycle, as a sentence. */
export function describeSharingErrorKind(kind: SharingErrorKind, t: Translate): string {
  return t(KIND_MESSAGES[kind]);
}

/**
 * The sentence to show for a failed sharing action, in the user's language.
 * Internal messages never reach the screen: they are English and for logs.
 */
export function describeSharingError(cause: unknown, t: Translate): string {
  if (cause instanceof InviteRejectedError) return t(INVITE_MESSAGES[cause.reason]);
  if (cause instanceof SharingError) return describeSharingErrorKind(cause.kind, t);
  return t('household.error.generic');
}
