import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/generated/**', '.tmp/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Browser-only theme reference.
    files: ['apps/web/reference/theme-preview/preview.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Node Playwright harnesses include callbacks evaluated inside the browser.
    files: [
      'apps/web/reference/capture-credit-profile.mjs',
      'docs/evidence/rec-02-commerce-integrity/browser-check.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
);
