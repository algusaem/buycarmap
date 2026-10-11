import { vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

// Runs the next `prisma.$transaction` for real, after letting `arrange` spy on
// its transaction client. A spy on the singleton (`vi.spyOn(prisma.user, …)`)
// never sees these calls: inside an interactive transaction the code goes
// through the transaction client's own model delegates.
export function arrangeNextTransaction(arrange: (tx: Prisma.TransactionClient) => void): void {
  const realTransaction = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementationOnce(((
    fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) =>
    realTransaction(async (tx) => {
      arrange(tx);
      return fn(tx);
    })) as typeof prisma.$transaction);
}
