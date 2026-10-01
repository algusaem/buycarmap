import { prisma } from "@/lib/db/prisma";
import type { Locale } from "@/lib/i18n/config";
import type { UserId } from "@/lib/ids";

export async function saveUserLocale(userId: UserId, locale: Locale): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { locale, updatedById: userId } });
}
