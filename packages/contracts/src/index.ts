/**
 * Shared kernel for RecetApp.
 *
 * Holds the request and response types exchanged between the mobile app and
 * the BFF, plus the two pure rules both sides must agree on: how an ingredient
 * name is normalized for matching, and how a suggestion mode is enforced.
 *
 * Those rules live here rather than on one side because disagreement between
 * them would not surface as an error - it would surface as wrong answers.
 */

export * from './types';
export * from './normalize';
export * from './enforce-suggestion-mode';
