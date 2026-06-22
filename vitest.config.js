import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@': path.join(dirname, 'src'),
          },
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{js,jsx}'],
          setupFiles: [path.join(dirname, 'vitest.setup.js')],
          // The integration tests share a real file-backed mock HCM store
          // (src/lib/hcm/store.js); running test files in parallel workers
          // would race on that file. This suite is small enough that
          // sequential execution costs nothing noticeable.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
