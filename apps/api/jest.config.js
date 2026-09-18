/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@recetapp/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
};
