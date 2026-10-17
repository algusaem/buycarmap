import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

/** Where the session stands: until its request resolves the buyer is neither signed in nor out. */
type SignInStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * The one sign-in gate for a control that needs an account (FAV-12, FAV-18;
 * docs/specs/redesign-map.md MAPUI-37, MAPUI-46): the heart and «Crear
 * alerta». `useSession` reports "loading" until the session request
 * resolves, and "loading" is not "signed out": sending a signed-in user to
 * /login makes proxy.ts bounce them to "/" (/login is guest-only), so a
 * caller ignores a press while loading. A signed-out buyer is sent to sign
 * in and back to `path`, query included. This is UX, not authorization: the
 * server actions check the session themselves.
 */
export function useSignInGate() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const status: SignInStatus = isPending
    ? "loading"
    : session
      ? "authenticated"
      : "unauthenticated";

  const redirectToSignIn = useCallback(
    (path: string) => router.push(`/login?callbackUrl=${encodeURIComponent(path)}`),
    [router],
  );

  // The one guard every caller needing an account repeats: ignore the press
  // while the session is still resolving, send a signed-out visitor to sign
  // in and back to `path`, and only a signed-in caller gets a true.
  const requireSession = useCallback(
    (path: string): boolean => {
      if (status === "loading") return false;
      if (status === "unauthenticated") {
        redirectToSignIn(path);
        return false;
      }
      return true;
    },
    [status, redirectToSignIn],
  );

  return { requireSession };
}
