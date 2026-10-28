// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const sharedTypeScriptRules = {
  // Allow non-null assertions — common in Angular with ViewChild etc.
  '@typescript-eslint/no-non-null-assertion': 'off',
  // Allow empty functions — lifecycle hooks, abstract stubs
  '@typescript-eslint/no-empty-function': 'off',
  // Warn on explicit any
  '@typescript-eslint/no-explicit-any': 'warn',
  // Warn on unused vars (allow underscore prefix to skip)
  '@typescript-eslint/no-unused-vars': [
    'warn',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  // Allow empty interfaces for DI tokens etc.
  '@typescript-eslint/no-empty-interface': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
};

module.exports = tseslint.config(
  {
    files: ['web/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      ...sharedTypeScriptRules,
      // Prefer inject() over constructor injection — warn for now
      '@angular-eslint/prefer-inject': 'warn',
    },
  },
  {
    files: ['server/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    rules: {
      ...sharedTypeScriptRules,
    },
  },
  {
    files: ['web/**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '**/.angular/',
      '**/dist-test/',
      'coverage/',
      'web/dist/',
      'server/dist/',
      '**/*.generated.ts',
    ],
  },
);
