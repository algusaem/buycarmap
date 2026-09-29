import { prisma } from "@/lib/db/prisma";
import type { Locale } from "@/lib/i18n/config";

export async function saveUserLocale(userId: string, locale: Locale): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { locale } });
}
