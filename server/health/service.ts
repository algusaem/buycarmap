import { prisma } from "@/lib/db/prisma";

// PLAT-20 (docs/specs/core-platform.md): the only raw query in the codebase,
// authorised by that approved spec (RULES.md §11). It exists purely to prove
// the connection works — there is no simpler way to ask Postgres "are you
// there?" through Prisma.
export async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
