const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

/**
 * One flat config for the whole workspace.
 *
 * The Expo preset assumes a React Native environment, so it is scoped to the
 * mobile app rather than applied repo-wide: the BFF runs on Node and has no
 * business being linted for hook rules or React Native globals.
 *
 * Prettier comes last and only turns rules off. Formatting is Prettier's job;
 * a linter that also argues about commas produces conflicting autofixes.
 */
module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/expo-env.d.ts',
    ],
  },

  // Expo preset, scoped to the app it describes.
  ...expoConfig
    .filter((entry) => !(entry.ignores && Object.keys(entry).length === 1))
    .map((entry) => ({ ...entry, files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'] })),

  // The Expo preset brings its own TypeScript parser. The BFF and the shared
  // package are outside its scope, so they need one declared here or their
  // files are parsed as plain JavaScript and every type annotation is a
  // syntax error.
  ...tseslint.configs.recommended.map((entry) => ({
    ...entry,
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
  })),

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // console.error is how the BFF reports upstream failures it refuses to
      // send to the client, so it stays allowed.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    // The rule below carries the plugin prefix, so the plugin has to be
    // registered in the same object that uses it.
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // An unused variable is either a leftover or a mistake. The underscore
      // prefix is the explicit way to say "deliberately ignored".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // TypeScript already resolves every import, with full knowledge of the
      // tsconfig path aliases and the workspace links. `npm run typecheck` is
      // the check that catches a bad path; this rule duplicates it and needs a
      // native resolver binary whose install script npm blocks here, so it
      // reports false failures instead of real ones.
      'import/no-unresolved': 'off',
    },
  },

  {
    // Config files are CommonJS by necessity: metro and eslint load them with
    // require before any transform is in play.
    files: ['**/*.config.js', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // The server entry point announces where it is listening. That line is
    // the whole point of running it.
    files: ['apps/api/src/server.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  prettierConfig,
];
