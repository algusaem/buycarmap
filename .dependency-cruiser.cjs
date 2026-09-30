/**
 * Enforces the server-layer boundaries of docs/specs/core-layout.md
 * (LAYOUT-6, LAYOUT-7, LAYOUT-8, LAYOUT-10). Wired into `pnpm lint` as `pnpm depcruise`.
 *
 * Type-only imports count like any other import (`tsPreCompilationDeps`).
 *
 * Every layer rule's `from` excludes test files (`\.test\.tsx?$`, which also
 * matches `*.node.test.ts`): tests import what they test and mock the
 * database, so the layer boundaries do not apply to them. The cycle rule,
 * no-circular, applies to them like to any other file.
 *
 * `@prisma/*` is matched pnpm-aware: a package resolves to
 * `node_modules/.pnpm/<package>@<version>/node_modules/@prisma/…`. The two
 * forms are spelled out as alternatives because dependency-cruiser refuses an
 * optional group around a quantifier as an unsafe regular expression. The
 * generated client is matched unresolved too (`@/app/generated/prisma…`), so
 * an import of it is still reported before `prisma generate` has run.
 */
module.exports = {
  forbidden: [
    {
      name: "no-prisma-outside-service",
      comment:
        "@prisma/* and the generated Prisma client are reached only from a feature's " +
        "server/<feature>/service.ts or from lib/db/** itself. The NextAuth exception " +
        "(LAYOUT-7) does not cover them: lib/auth/options.ts reaches the database only " +
        "through lib/db/**.",
      severity: "error",
      from: {
        pathNot: ["^server/[^/]+/service\\.ts$", "^lib/db/", "\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^(node_modules/@prisma/|node_modules/\\.pnpm/[^/]+/node_modules/@prisma/|app/generated/prisma/|@/app/generated/prisma)",
      },
    },
    {
      name: "no-db-module-outside-service",
      comment:
        "lib/db/** is reached only from a feature's server/<feature>/service.ts, from " +
        "lib/db/** itself, or from lib/auth/options.ts: the NextAuth exception (ADR 0007 " +
        "row 25, until phase 11, LAYOUT-7), whose Prisma adapter needs the client. Its " +
        "other edge, to server/auth/service.ts, is auth-options-server-exception below.",
      severity: "error",
      from: {
        pathNot: [
          "^server/[^/]+/service\\.ts$",
          "^lib/db/",
          "^lib/auth/options\\.ts$",
          "\\.test\\.tsx?$",
          "^test/",
        ],
      },
      to: {
        path: "^lib/db/",
      },
    },
    {
      name: "app-only-queries-actions-or-schema",
      comment:
        "app/** may import only a feature's queries.ts, actions.ts or schema.ts from " +
        "server/** (LAYOUT-6). A route.ts under app/api/** has its own, wider rule below " +
        "(LAYOUT-8, route-handlers-also-service).",
      severity: "error",
      from: {
        path: "^app/",
        pathNot: ["^app/api/.+/route\\.ts$", "\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^server/",
        pathNot: "/(queries|actions|schema)\\.ts$",
      },
    },
    {
      name: "route-handlers-also-service",
      comment:
        "A route.ts under app/api/** may also import a feature's service.ts (LAYOUT-8) — it " +
        "has no user session and authenticates on its own (the cron secret, an unsubscribe " +
        "token), so it cannot go through actions.ts. Every other file under server/ stays " +
        "out of its reach, as for the rest of app/**.",
      severity: "error",
      from: {
        path: "^app/api/.+/route\\.ts$",
      },
      to: {
        path: "^server/",
        pathNot: "/(queries|actions|schema|service)\\.ts$",
      },
    },
    {
      name: "components-only-actions-or-schema",
      comment:
        "components/** may import only a feature's actions.ts (Server Actions) or " +
        "schema.ts (the runtime schema zodResolver needs) from server/**.",
      severity: "error",
      from: {
        path: "^components/",
        pathNot: ["\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^server/",
        pathNot: "/(actions|schema)\\.ts$",
      },
    },
    {
      name: "no-app-from-lib",
      comment:
        "lib/** never imports app/**. The one physical exception, the generated Prisma " +
        "client under app/generated/prisma/, is governed by no-prisma-outside-service instead.",
      severity: "error",
      from: {
        path: "^lib/",
        pathNot: ["\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^app/(?!generated/)",
      },
    },
    {
      name: "no-server-from-lib",
      comment:
        "lib/** never imports server/**, except lib/auth/options.ts, which has its own, " +
        "narrower exception below (LAYOUT-7, auth-options-server-exception), and " +
        "lib/hooks/**, which has its own exception below (LAYOUT-10, " +
        "hooks-only-actions-or-schema).",
      severity: "error",
      from: {
        path: "^lib/",
        pathNot: ["^lib/auth/options\\.ts$", "^lib/hooks/", "\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^server/",
      },
    },
    {
      name: "hooks-only-actions-or-schema",
      comment:
        "LAYOUT-10: lib/hooks/** may import only a feature's actions.ts or schema.ts from " +
        "server/**, just as components/** may — a hook owns a request lifecycle, and the " +
        "request is a Server Action. Every other file under lib/** stays bound by " +
        "no-server-from-lib above, and lib/hooks/** stays bound by no-app-from-lib.",
      severity: "error",
      from: {
        path: "^lib/hooks/",
        pathNot: ["\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^server/",
        pathNot: "/(actions|schema)\\.ts$",
      },
    },
    {
      name: "auth-options-server-exception",
      comment:
        "The NextAuth exception (ADR 0007 row 25, until phase 11): lib/auth/options.ts needs " +
        "the Prisma adapter and server/auth/service.ts's authorizeCredentials, and stays " +
        "outside the server layer so server components can import it without dragging in a " +
        "route (CLAUDE.md). This is the only edge allowed here — no other file under lib/ may " +
        "reach server/auth/service.ts (see no-server-from-lib above), and this file may reach " +
        "no other target under server/.",
      severity: "error",
      from: {
        path: "^lib/auth/options\\.ts$",
      },
      to: {
        path: "^server/",
        pathNot: "^server/auth/service\\.ts$",
      },
    },
    {
      name: "cross-feature-only-service-or-schema",
      comment:
        "A feature under server/<feature>/ may import another feature only through that " +
        "other feature's service.ts or schema.ts — never its queries.ts or actions.ts.",
      severity: "error",
      from: {
        path: "^server/([^/]+)/",
        pathNot: ["\\.test\\.tsx?$", "^test/"],
      },
      to: {
        path: "^server/(?!$1/)[^/]+/",
        pathNot: "^server/[^/]+/(service|schema)\\.ts$",
      },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies anywhere in the cruised roots, test files included.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    // Type-only imports are real edges: an `import type` from server/** in
    // lib/** breaks the layer as much as a runtime import does (LAYOUT-6).
    tsPreCompilationDeps: true,
    // Recorded as dependencies, so the rules above see @prisma/* and the
    // generated client, but never cruised into.
    doNotFollow: {
      path: "(^|/)node_modules/|^app/generated/",
    },
    // Build output only. The cruised roots are the ones `pnpm depcruise` names.
    exclude: {
      path: "(^|/)(\\.next|coverage|\\.claude/worktrees)/",
    },
  },
};
