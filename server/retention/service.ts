import { prisma } from "@/lib/db/prisma";

// DATA-12 (docs/specs/core-data-model.md): soft-deleted rows are erased 30
// days after `deletedAt`, purged opportunistically from the same paths that
// already prune expired auth rows (`maybePruneExpiredAuthRows`), with no new
// scheduler. Only `Favorite` and `Alert` are ever soft-deleted (DATA-10); every
// other model's `deletedAt` exists for uniformity and is never set (DATA-14).

const SOFT_DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Hard-deletes a `Favorite` or `Alert` row 30 days after it was soft-deleted,
 * then an `AlertCriteria` row that no longer has any alert referencing it,
 * soft-deleted or not (ALERT-42) — the last reference to it may have just
 * been hard-deleted above, or deactivated/soft-deleted earlier. The cascade
 * on `AlertSeenListing` and `AlertPollJob` removes the seen-list and any
 * queued poll job with it. Returns the count removed.
 */
export async function purgeSoftDeletedRows(now: Date): Promise<number> {
  const threshold = new Date(now.getTime() - SOFT_DELETE_RETENTION_MS);

  const [favorites, alerts] = await Promise.all([
    prisma.favorite.deleteMany({ where: { deletedAt: { lt: threshold } } }),
    prisma.alert.deleteMany({ where: { deletedAt: { lt: threshold } } }),
  ]);

  const criteria = await prisma.alertCriteria.deleteMany({ where: { alerts: { none: {} } } });

  return favorites.count + alerts.count + criteria.count;
}
