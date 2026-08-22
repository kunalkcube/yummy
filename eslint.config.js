// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Fetch-on-mount screens set loading state in effects; keep that pattern.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
