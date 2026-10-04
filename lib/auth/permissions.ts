// BAUTH-16 (docs/specs/core-better-auth.md): the single home for
// authorization logic (`RULES.md` §10). Every ownership check in
// `server/*/actions.ts`, `queries.ts` and `service.ts` goes through `can()`
// or `ownedBy()` (BAUTH-17) rather than comparing `userId` inline.
//
// There are no roles: every user-owned resource is readable and writable
// only by its owner, so `can()` reduces to one ownership comparison per
// resource shape.

export type PermissionAction = "read" | "update" | "delete";

export type PermissionResource =
  | { type: "user"; id: string }
  | {
      type: "account" | "favorite" | "alert" | "recoveryCode" | "session";
      userId: string;
    };

export interface PermissionUser {
  id: string;
}

/** Allows only when `resource` belongs to `user`. `action` does not change the
 * answer today — there are no roles that can read but not write, or vice versa
 * — but it stays a parameter so a future permission can depend on it without
 * changing every call site. */
export function can(
  user: PermissionUser,
  _action: PermissionAction,
  resource: PermissionResource,
): boolean {
  const ownerId = resource.type === "user" ? resource.id : resource.userId;
  return ownerId === user.id;
}

/** The query filter that scopes a lookup to `user`'s own rows. */
export function ownedBy(user: PermissionUser): { userId: string } {
  return { userId: user.id };
}
