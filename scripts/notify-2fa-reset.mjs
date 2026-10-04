// BAUTH-13 (docs/specs/core-better-auth.md): run once after the Better Auth
// cutover (`pnpm auth:notify-2fa-reset`) to mail every user whose old
// two-factor enrolment the migration switched off. Idempotent: a user is
// only ever selected while `twoFactorResetNotifiedAt` is still null, which
// this sets right after sending, so running the script twice sends nothing
// the second time.
//
// Run through `tsx` (prisma.config.ts's own `seed` entry is the same
// pattern) so it can import the real app modules — the Prisma client, the
// email templates, next-intl — by their `@/*` path aliases, rather than
// duplicating that logic here as raw SQL.

import { pathToFileURL } from "node:url";
import { prisma } from "@/lib/db/prisma";
import { notifyTwoFactorReset } from "@/server/two-factor/reenrol";

export async function main() {
  // A user had the old two-factor on (`twoFactorEnabledAt` set) and has not
  // yet enrolled through the new plugin (no `two_factors` row) and has not
  // already been told.
  const recipients = await prisma.user.findMany({
    where: {
      twoFactorEnabledAt: { not: null },
      twoFactorResetNotifiedAt: null,
      twoFactors: { none: {} },
    },
    select: { id: true, email: true, locale: true },
  });

  if (recipients.length === 0) {
    console.log("No users to notify — nothing left to do.");
    return;
  }

  await notifyTwoFactorReset(recipients);

  await prisma.user.updateMany({
    where: { id: { in: recipients.map((user) => user.id) } },
    data: { twoFactorResetNotifiedAt: new Date() },
  });

  console.log(`Notified ${recipients.length} user(s) to re-enrol in two-factor authentication.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
  await prisma.$disconnect();
}
