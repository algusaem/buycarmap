import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two projects share the same plugins (React JSX + `@/*` path aliases) but run
// in different environments:
//   - "unit"  → jsdom: pure lib, source clients (need `window.location`),
//               hooks, and components. Everything except node-only tests.
//   - "node"  → node: Next.js route handlers and server actions, which need the
//               real Node request/response globals, not jsdom's. Opt in by
//               naming the file `*.node.test.ts`.
export default defineConfig({
  plugins: [react()],
  // `@/*` path aliases resolved natively from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // `lib/env.ts` validates required configuration at import time and throws
    // when it is missing. Anything importing it transitively (server actions,
    // authOptions) would fail to load without these. Values are dummies — no
    // test connects to a real database or signs a real production token.
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/buycarmap_test",
      NEXTAUTH_SECRET: "test-secret-at-least-32-characters-long",
      NEXTAUTH_URL: "http://localhost:3000",
      APP_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**", "app/**"],
      exclude: [
        "app/generated/**",
        "lib/mock/**",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/index.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.jsdom.ts"],
          include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
          exclude: ["**/*.node.test.ts", "e2e/**", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./test/setup.node.ts"],
          include: [
            "{lib,app}/**/*.node.test.ts",
            // `proxy.ts` is required to sit at the repo root by Next's file
            // convention, so its colocated test does not match the glob above.
            "proxy.node.test.ts",
            "test/contract/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
