/**
 * Invite codes are typed by a person reading them off another phone, so the
 * alphabet drops every character that looks like another one: 0/O, 1/I/L and U
 * (easily misread as V).
 *
 * 30 symbols over 8 positions is about 39 bits. That is not enough on its own
 * against an offline attacker, which is why the server also expires codes after
 * a day, makes them single use and throttles failed attempts (docs/SHARING.md).
 */
export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;

const GROUP_SIZE = 4;

/** Uppercases and drops everything that is not a letter or digit (spaces, dashes). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** `ABCDEFGH` becomes `ABCD-EFGH`; a partial code is grouped as far as it goes. */
export function formatInviteCode(input: string): string {
  const code = normalizeInviteCode(input);
  if (code.length <= GROUP_SIZE) return code;
  return `${code.slice(0, GROUP_SIZE)}-${code.slice(GROUP_SIZE)}`;
}

/** True when the code has the right length and only uses the alphabet. */
export function isCompleteInviteCode(input: string): boolean {
  const code = normalizeInviteCode(input);
  if (code.length !== INVITE_CODE_LENGTH) return false;
  return [...code].every((char) => INVITE_ALPHABET.includes(char));
}
