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
      // A ratchet, not a target. Set a point below what the suite measured
      // when it was introduced, so ordinary variance doesn't fail CI but a
      // meaningful drop does. Raise these when coverage rises; never lower
      // them to make a red build green. Route shells (`app/**/page.tsx`,
      // `layout.tsx`) are deliberately still counted even though Playwright
      // is what exercises them — excluding them would flatter the number and
      // hide logic that drifts into a page.
      // Raised once at the end of the spec backfill (2026-08-02), from the
      // 87/82/81/87 the suite started at. Same rule as before: a point under
      // what was measured, so variance does not fail CI but a real drop does.
      thresholds: {
        statements: 89,
        branches: 85,
        functions: 84,
        lines: 89,
      },
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
            // Dev tooling that rewrites .env files. Not app code, but a bug
            // here clobbers real secrets, so it is covered.
            "scripts/**/*.node.test.ts",
          ],
        },
      },
    ],
  },
});
