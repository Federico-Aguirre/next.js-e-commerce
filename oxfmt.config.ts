/**
 * @file oxfmt.config.ts
 * @description Configuration file for Oxfmt, a high-performance Rust-based code formatter.
 * It enforces consistent code style, indentation, and formatting across the repository as an alternative to Prettier.
 */

import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  singleQuote: true,
  ignorePatterns: ['migrations/*', '*.md'],
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: 'asc',
  },
  sortTailwindcss: {
    stylesheet: 'src/app/globals.css',
  },
});
