/**
 * Enforces the server-layer boundaries of docs/specs/core-layout.md
 * (LAYOUT-6, LAYOUT-7, LAYOUT-8). Wired into `pnpm lint` as `pnpm depcruise`.
 *
 * Every rule's `from` excludes test files (`\.test\.tsx?$`, which also
 * matches `*.node.test.ts`): tests mock the modules they import, so the
 * boundaries below do not apply to them.
 */
module.exports = {
  forbidden: [
    {
      name: "no-db-outside-service",
      comment:
        "@prisma/*, the generated Prisma client and lib/db/** are reached only from a " +
        "feature's server/<feature>/service.ts, from lib/db/** itself, or from the NextAuth " +
        "exception lib/auth/options.ts (LAYOUT-7, see auth-options-server-exception below).",
      severity: "error",
      from: {
        pathNot: [
          "^server/[^/]+/service\\.ts$",
          "^lib/db/",
          "^lib/auth/options\\.ts$",
          "\\.test\\.tsx?$",
        ],
      },
      to: {
        path: "^(node_modules/@prisma/|app/generated/prisma/|lib/db/)",
      },
    },
    {
      name: "no-service-from-app",
      comment:
        "app/** never imports a feature's service.ts, except a route.ts under app/api/** " +
        "(LAYOUT-8) — it has no user session and authenticates on its own (the cron secret, " +
        "an unsubscribe token), so it cannot go through actions.ts.",
      severity: "error",
      from: {
        path: "^app/",
        pathNot: ["^app/api/.+/route\\.ts$", "\\.test\\.tsx?$"],
      },
      to: {
        path: "/service\\.ts$",
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
        pathNot: "\\.test\\.tsx?$",
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
        "client under app/generated/prisma/, is governed by no-db-outside-service instead.",
      severity: "error",
      from: {
        path: "^lib/",
        pathNot: "\\.test\\.tsx?$",
      },
      to: {
        path: "^app/(?!generated/)",
      },
    },
    {
      name: "no-server-from-lib",
      comment:
        "lib/** never imports server/**, except lib/auth/options.ts, which has its own, " +
        "narrower exception below (LAYOUT-7, auth-options-server-exception).",
      severity: "error",
      from: {
        path: "^lib/",
        pathNot: ["^lib/auth/options\\.ts$", "\\.test\\.tsx?$"],
      },
      to: {
        path: "^server/",
      },
    },
    {
      name: "auth-options-server-exception",
      comment:
        "The NextAuth exception (ADR 0007 row 25, until phase 11): lib/auth/options.ts needs " +
        "the Prisma adapter and server/auth/service.ts's authorize/cleanup/verify, and stays " +
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
        pathNot: "\\.test\\.tsx?$",
      },
      to: {
        path: "^server/(?!$1/)[^/]+/",
        pathNot: "^server/[^/]+/(service|schema)\\.ts$",
      },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies anywhere in the code roots below.",
      severity: "error",
      from: {
        pathNot: "\\.test\\.tsx?$",
      },
      to: {
        circular: true,
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "app/generated|\\.next|node_modules|coverage|\\.claude/worktrees",
    },
    includeOnly: {
      path: "^(app|components|lib|interfaces|types|server|proxy\\.ts)",
    },
  },
};
