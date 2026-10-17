import { useCallback, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { AUTH_ERROR, refusalCode } from "@/lib/auth/errors";
import { exportMyData, type AccountResult } from "@/server/account/actions";
import { dataExportEnvelopeSchema } from "@/server/account/schema";

// EXPORT-14/15 (docs/specs/account-data-export.md): owns the request
// lifecycle of the "Download my data" section on /account (CLAUDE.md › Stack
// today — client request lifecycles live in lib/hooks/*). One export at a
// time: the ref drops a second activation even before the disabled button
// has re-rendered.

/** Hands `data` to the browser as a file download. */
function saveAsFile(data: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next task, not synchronously: some browsers read the URL
  // only after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `buycarmap-data-<YYYY-MM-DD>.json`, the UTC date of the export's own `exportedAt`. */
function exportFileName(data: string): string {
  const { exportedAt } = dataExportEnvelopeSchema.parse(JSON.parse(data));
  return `buycarmap-data-${exportedAt.slice(0, 10)}.json`;
}

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const runningRef = useRef(false);

  /**
   * Runs one export and downloads it. Resolves to the action's outcome, or to
   * `undefined` when an export was already running and this call was ignored.
   */
  const startExport = useCallback(async (): Promise<AccountResult | undefined> => {
    if (runningRef.current) return undefined;
    runningRef.current = true;
    setIsExporting(true);

    try {
      const result = await exportMyData();
      if (!result.success || result.data === undefined) {
        return { success: false, error: refusalCode(result.error) };
      }
      saveAsFile(result.data, exportFileName(result.data));
      return { success: true };
    } catch (error) {
      Sentry.captureException(error);
      return { success: false, error: AUTH_ERROR.generic };
    } finally {
      runningRef.current = false;
      setIsExporting(false);
    }
  }, []);

  return { isExporting, startExport };
}
