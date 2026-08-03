import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code skills (reference templates, not source code)
    ".claude/**",
    // v8 coverage output. Generated, gitignored, and its vendored HTML-report
    // scripts carry eslint-disable directives that this config has no rules
    // for — so a local `pnpm test:coverage` left `pnpm lint` reporting a
    // warning about a file nobody wrote.
    "coverage/**",
  ]),
]);

export default eslintConfig;
