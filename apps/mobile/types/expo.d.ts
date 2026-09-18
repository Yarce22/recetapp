/// <reference types="expo/types" />

// Pulls in Expo's ambient declarations - CSS module imports, the asset
// modules, and the env types.
//
// Expo generates an equivalent `expo-env.d.ts` at the project root, but it
// regenerates that file and re-adds it to .gitignore on every `expo install`,
// so it cannot be relied on in a fresh clone. This file is ours and tracked,
// which is what lets `npm run typecheck` pass before the dev server has ever
// been started.
