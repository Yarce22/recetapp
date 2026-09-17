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

module.exports = config;
