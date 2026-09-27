/**
 * @file oxlint.config.ts
 * @description Configuration file for Oxlint, an ultra-fast JavaScript/TypeScript linter written in Rust.
 * It detects potential code errors, bad practices, and performance anti-patterns with near-instant execution times.
 */

import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import next from 'ultracite/oxlint/next';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

export default defineConfig({
  extends: [core, react, next, vitest],
  rules: {
    'no-warning-comments': 'off', // Allows TODO and FIXME comments
    'no-inline-comments': 'off', // Allows inline comments

    'sort-keys': 'off',
    'func-style': 'off',

    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'typescript/consistent-type-definitions': ['error', 'type'], // Enforces the use of 'type' over 'interface'
    'typescript/no-misused-promises': 'off', // Required for React Hook Form async handlers
    'typescript/strict-void-return': 'off',
    'typescript/prefer-regexp-exec': 'off',

    'prefer-named-capture-group': 'off',

    'react/function-component-definition': 'off',
    'react/no-unstable-nested-components': 'off',

    'unicorn/filename-case': 'off',

    // Disabled to avoid noisy warnings when scaffolding functions or components quickly
    'jsdoc/require-param': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns': 'off',
    'jsdoc/require-returns-description': 'off',
  },
  options: {
    reportUnusedDisableDirectives: 'error',
  },
});
