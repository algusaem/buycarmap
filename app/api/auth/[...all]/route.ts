// BAUTH-1/BAUTH-6 (docs/specs/core-better-auth.md): serves lib/auth/auth.ts's
// Better Auth instance. `app/api/auth/[...nextauth]/route.ts` and
// `lib/auth/options.ts` are removed — this is the only HTTP entry point for
// auth now, and `disabledPaths` on `auth` keeps the six flows that stay ours
// (registration, password reset, email verification/change) unreachable
// through it. The handler itself is built in lib/auth/auth.ts, the only
// module (besides lib/auth/auth-client.ts) that may import `better-auth`.
export { GET, POST } from "@/lib/auth/auth";
