import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type { import('@storybook/nextjs-vite').StorybookConfig } */
const config = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "..\\public"
  ],
  // The Next.js dev server resolves the "@/" alias from jsconfig.json, but
  // this builder's own Vite instance doesn't read jsconfig.json — every
  // component importing "@/..." 500s in the browser without this.
  async viteFinal(viteConfig) {
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      "@": path.join(dirname, "..", "src"),
    };
    return viteConfig;
  },
};
export default config;