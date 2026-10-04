import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { authClient } from "@/lib/auth/auth-client";
import {
  listMySessions,
  revokeMySession,
  revokeOtherMySessions,
  type AccountResult,
  type MySession,
} from "@/server/account/actions";

// BAUTH-4 (docs/specs/core-better-auth.md): owns the request lifecycle for
// the "Active sessions" section on /account (CLAUDE.md › Stack today —
// client request lifecycles live in lib/hooks/*, components only consume
// them). Mirrors useFavorites.ts's shape for the "signed-in only" fetch, and
// useLocationSearch.ts's version-ref shape for guarding against an
// out-of-order response — needed here because `refresh()` (after a revoke)
// has to be callable on demand, not just once per mount.

export type MySessionsStatus = "loading" | "error" | "ready";

export function useMySessions() {
  const { data: session, isPending } = authClient.useSession();
  const authStatus = isPending ? "loading" : session ? "authenticated" : "unauthenticated";
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [status, setStatus] = useState<MySessionsStatus>("loading");
  const versionRef = useRef(0);

  const load = useCallback(async () => {
    const version = ++versionRef.current;
    setStatus("loading");

    try {
      const result = await listMySessions();
      if (versionRef.current !== version) return;
      setSessions(result);
      setStatus("ready");
    } catch (error) {
      if (versionRef.current !== version) return;
      setStatus("error");
      Sentry.captureException(error);
    }
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    load();
    // No cleanup to cancel the in-flight request on: `load`'s own version
    // check already drops a response from a request that is no longer the
    // latest, the same way unmounting and remounting while signed in would.
  }, [authStatus, load]);

  const revokeSession = useCallback(
    async (sessionId: string): Promise<AccountResult> => {
      const result = await revokeMySession(sessionId);
      if (result.success) await load();
      return result;
    },
    [load],
  );

  const revokeOthers = useCallback(async (): Promise<AccountResult> => {
    const result = await revokeOtherMySessions();
    if (result.success) await load();
    return result;
  }, [load]);

  return {
    sessions: authStatus === "authenticated" ? sessions : [],
    status: authStatus === "authenticated" ? status : "loading",
    revokeSession,
    revokeOthers,
  };
}
