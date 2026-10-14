import {
  INVITE_ALPHABET,
  formatInviteCode,
  isCompleteInviteCode,
  normalizeInviteCode,
} from '../invite-code';

describe('invite codes', () => {
  it('uses an alphabet without look-alike characters', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', 'L', 'U']) {
      expect(INVITE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('normalizes what a person types or pastes', () => {
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('abcd efgh')).toBe('ABCDEFGH');
  });

  it('formats a code in two groups of four', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('formats a partial code while it is being typed', () => {
    expect(formatInviteCode('ABC')).toBe('ABC');
    expect(formatInviteCode('ABCDE')).toBe('ABCD-E');
  });

  it('accepts a complete code and rejects the rest', () => {
    expect(isCompleteInviteCode('ABCDEFGH')).toBe(true);
    expect(isCompleteInviteCode('ABCDEFG')).toBe(false);
    expect(isCompleteInviteCode('ABCDEFGHJ')).toBe(false);
    // 0 and O are not in the alphabet, so the code cannot exist.
    expect(isCompleteInviteCode('ABCDEF0H')).toBe(false);
  });
});
