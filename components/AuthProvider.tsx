// BAUTH-1 (docs/specs/core-better-auth.md): `authClient.useSession()` reads
// from Better Auth's own nanostores atom, which needs no context provider —
// unlike NextAuth's `SessionProvider`, which this used to wrap `children` in.
// Kept as a component (rather than removed from app/layout.tsx) so the
// layout's import stays stable if a future provider is ever needed again.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return children;
}
