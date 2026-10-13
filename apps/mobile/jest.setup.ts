// Global test setup for the mobile app.
//
// jest-expo already installs the React Native environment. This file is the
// place for project-wide mocks (notifications, SQLite, the BFF client) as
// those adapters land from Phase 1 onwards.

export {};

// Icon fonts load asynchronously and update state after the test has moved
// on, which floods the output with act() warnings. Icons carry no behavior
// the tests assert on, so they render nothing here.
jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
}));
