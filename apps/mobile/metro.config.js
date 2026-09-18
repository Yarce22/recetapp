// Metro configuration for a monorepo workspace.
//
// Without watchFolders and nodeModulesPaths, Metro only looks inside
// apps/mobile and cannot resolve @recetapp/contracts, which npm links from
// the workspace root.
//
// Hierarchical lookup is deliberately left at Expo's default. Disabling it is
// older monorepo advice that expo-doctor now flags as a misconfiguration.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// expo-sqlite runs on web through a WebAssembly build of SQLite. Metro treats
// unknown extensions as source, so without this it tries to parse the .wasm
// file as JavaScript and fails to resolve it.
config.resolver.assetExts.push('wasm');

// That WASM build needs SharedArrayBuffer, which browsers only expose to
// cross-origin isolated documents. These two headers are what grants the dev
// server that isolation; without them the web build resolves but then fails at
// runtime.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return middleware(req, res, next);
  },
};

module.exports = config;
