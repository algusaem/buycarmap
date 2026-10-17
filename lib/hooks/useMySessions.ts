import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  listMySessions,
  revokeMySession,
  revokeOtherMySessions,
  type AccountResult,
  type MySession,
} from "@/server/account/actions";

// BAUTH-4 (docs/specs/core-better-auth.md): owns the request lifecycle of
// the «Sesiones» dialog on /account (CLAUDE.md › Stack today — client request
// lifecycles live in lib/hooks/*, components only consume them). The list is
// read again each time the dialog opens (docs/specs/redesign-pages.md,
// PAGES-49): the dialog's content mounts on each opening, and this reads on
// mount. Only the signed-in /account page opens it, and `listMySessions`
// itself answers nothing to a signed-out caller: a list with no session,
// not even this one, means this session ended elsewhere, and reads as the
// failed read with its «Reintentar» (docs/specs/redesign-pages.md, Edge cases). The version ref drops an
// out-of-order response, as useLocationSearch.ts does — needed because a
// retry and the re-read after a revoke can overlap the first read.

export type MySessionsStatus = "loading" | "error" | "ready";

export function useMySessions() {
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [status, setStatus] = useState<MySessionsStatus>("loading");
  const [retrying, setRetrying] = useState(false);
  const versionRef = useRef(0);

  /** Reads the list; `quiet` keeps what is on screen while it does (after a revoke, on a retry). */
  const read = useCallback(async (quiet: boolean) => {
    const version = ++versionRef.current;
    if (!quiet) setStatus("loading");

    try {
      const result = await listMySessions();
      if (versionRef.current !== version) return;
      if (result.length === 0) {
        setStatus("error");
        return;
      }
      setSessions(result);
      setStatus("ready");
    } catch (error) {
      if (versionRef.current !== version) return;
      setStatus("error");
      Sentry.captureException(error);
    }
  }, []);

  /**
   * «Reintentar» (PAGES-50): the read again, with the failed read kept on
   * screen and `retrying` true until it answers. No placeholder state in
   * between: a third state that the answer could replace before it even
   * mounted would leave the placeholders stuck.
   */
  const reload = useCallback(async () => {
    setRetrying(true);
    await read(true);
    setRetrying(false);
  }, [read]);

  useEffect(() => {
    read(false);
    // No cleanup to cancel the in-flight request on: `read`'s own version
    // check already drops a response from a request that is no longer the
    // latest.
  }, [read]);

  const revokeSession = useCallback(
    async (sessionId: string): Promise<AccountResult> => {
      const result = await revokeMySession(sessionId);
      if (result.success) await read(true);
      return result;
    },
    [read],
  );

  const revokeOthers = useCallback(async (): Promise<AccountResult> => {
    const result = await revokeOtherMySessions();
    if (result.success) await read(true);
    return result;
  }, [read]);

  return { sessions, status, retrying, reload, revokeSession, revokeOthers };
}
