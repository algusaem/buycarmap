// DATA-10 (docs/specs/core-data-model.md): one helper every soft-deletable
// read spreads into its `where`, so "exclude a soft-deleted row" is a single
// definition instead of a `deletedAt: null` repeated — and possibly
// mistyped — at every call site. Covers `Favorite`, `Alert` and
// `AlertCriteria` reads, plus the alert runner's subscriber query.
export const notDeleted = { deletedAt: null } as const;
