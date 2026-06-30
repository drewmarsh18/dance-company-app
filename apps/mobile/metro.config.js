const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const monorepoRoot = path.resolve(__dirname, "../..")
const config = getDefaultConfig(__dirname)

// Allow Metro to follow pnpm symlinks into the monorepo root's .pnpm store
config.watchFolders = [monorepoRoot]

// Resolve @/ alias to the project root
config.resolver.alias = {
  "@": path.resolve(__dirname),
}

module.exports = config
