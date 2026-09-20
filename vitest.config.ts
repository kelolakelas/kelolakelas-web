import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Next.js resolves `@/*` through the `paths` mapping in `tsconfig.json`, but
 * Vitest does not read that file. The alias below mirrors `"@/*": ["./*"]` so
 * tests can import application modules the same way the app does. Without it,
 * any test reaching a Server Action fails to resolve the action's own imports.
 *
 * Defaults are kept deliberately: the test environment stays `node` and the
 * default include pattern still collects the existing `*.test.ts` files, so no
 * current test changes behaviour.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
