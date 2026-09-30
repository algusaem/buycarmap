import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { env } from "@/lib/env";

// Cached on globalThis so Next.js dev HMR reuses one connection pool instead of
// opening a new one on every reload (and exhausting Neon's connection limit).
//
// Typed as `unknown` rather than `PrismaClient | undefined`: two `declare
// global` blocks for the same variable must declare the same type, and
// lib/db/prisma.node.test.ts has its own copy of this augmentation (typed
// `unknown`) so it can reset the cache between cases without an unsafe cast.
// This one matches it, and narrows locally with a single assertion instead —
// never a cast bridged through `unknown`.
declare global {
  var prisma: unknown;
}

function createPrismaClient(): PrismaClient {
  // VERCEL is set on every Vercel deployment (production and preview alike),
  // never locally. There the pooled DATABASE_URL goes through Neon's
  // serverless driver; everywhere else it's a plain Postgres connection.
  const adapter = env.VERCEL
    ? new PrismaNeon({ connectionString: env.DATABASE_URL })
    : new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const cached = globalThis.prisma as PrismaClient | undefined;
const client = cached ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.prisma = client;
}

export { client as prisma };
