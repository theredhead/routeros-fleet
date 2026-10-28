/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [
    angular({
      tsconfig: 'tsconfig.spec.json',
      inlineStylesExtension: 'scss',
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@fleet/configuration': resolve(root, '../server/src/configuration/index.ts'),
      '@fleet/filters': resolve(root, '../server/src/filters/filter-definition.ts'),
    },
  },
});
