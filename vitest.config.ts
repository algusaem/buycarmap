import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Three projects share the same plugins (React JSX + `@/*` path aliases) but
// run in different environments:
//   - "unit"        → jsdom: pure lib, source clients (need `window.location`),
//                      hooks, and components. Everything except node-only and
//                      integration tests.
//   - "node"         → node: Next.js route handlers and server actions, which
//                      need the real Node request/response globals, not
//                      jsdom's. Opt in by naming the file `*.node.test.ts`. No
//                      database — Prisma is mocked or absent.
//   - "integration"  → node, against a real Postgres (Testcontainers). Opt in
//                      by naming the file `*.integration.test.ts`
//                      (docs/specs/core-testing.md, TEST-5..8).
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
      include: [
        "lib/**",
        "components/**",
        "app/**",
        "server/**",
        "proxy.ts",
        "scripts/**",
        "prisma/seed.ts",
      ],
      exclude: ["app/generated/**", "**/*.test.{ts,tsx}", "**/*.d.ts"],
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
          include: [
            "{lib,components,app,server}/**/*.test.{ts,tsx}",
            // FRONT-8/FRONT-21: the message files' own key-parity test.
            "messages/**/*.test.ts",
          ],
          exclude: ["**/*.node.test.ts", "**/*.integration.test.ts", "e2e/**", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./test/setup.node.ts"],
          include: [
            "{lib,app,server}/**/*.node.test.ts",
            // `proxy.ts` is required to sit at the repo root by Next's file
            // convention, so its colocated test does not match the glob above.
            "proxy.node.test.ts",
            // FRONT-9: next-intl's getRequestConfig locale resolution.
            "i18n/**/*.node.test.ts",
            // INT-13/INT-14 (docs/specs/core-integrations.md): react-email
            // templates render server-side, same reasoning as i18n/ above.
            "emails/**/*.node.test.ts",
            "test/contract/**/*.test.ts",
            // Dev tooling that rewrites .env files. Not app code, but a bug
            // here clobbers real secrets, so it is covered.
            "scripts/**/*.node.test.ts",
            "prisma/**/*.node.test.ts",
          ],
          exclude: ["**/*.integration.test.ts", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          globalSetup: ["./test/integration.global-setup.ts"],
          // `setup.node.ts` first (MSW, for the upstream-API mocks some of
          // these files still need), then `setup.integration.ts`, which must
          // set `DATABASE_URL` to the real per-worker database before
          // anything imports the shared Prisma client — see the comment there.
          setupFiles: ["./test/setup.node.ts", "./test/setup.integration.ts"],
          include: ["{app,lib,server,prisma,test}/**/*.integration.test.ts"],
          exclude: ["node_modules/**"],
          // The container starts once per run in globalSetup, and each
          // worker's first test copies its own database from the template —
          // slower than the no-database projects' default hook timeout.
          hookTimeout: 120_000,
          // Real inserts: the alert-cadence tests write a few hundred rows, which
          // outruns the 5 s default when every worker shares one Docker VM.
          testTimeout: 30_000,
        },
      },
    ],
  },
});
