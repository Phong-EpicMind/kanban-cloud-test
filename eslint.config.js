const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', '_site/'] },
  js.configs.recommended,
  { files: ['logic.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.node } } },
  { files: ['app.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, KanbanLogic: 'readonly' } } },
  { files: ['*.config.js', 'tests/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } } },
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
];
