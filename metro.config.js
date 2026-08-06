const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (Array.isArray(config.watchFolders)) {
  config.watchFolders = config.watchFolders.filter(
    (folder) => !folder.includes("src-tauri")
  );
}

const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  /src-tauri[\\/].*/,
];

module.exports = config;
