import type { FullConfig } from "@playwright/test";

interface BaselineCheck {
  name: string;
  platform: string;
  updateSnapshots: FullConfig["updateSnapshots"];
  baselineExists: boolean;
}

/**
 * TEST-15 (docs/specs/core-testing.md): why a visual test skips, or `null`
 * when it runs.
 *
 * It skips when this platform has no baseline — unless the run was asked to
 * write one. `-u` sets `updateSnapshots` to "changed" and `-u all` to "all",
 * and both create missing baselines; skipping there made the command this
 * reason recommends unable to produce the file it says is missing. A plain run
 * uses "missing", which must still skip: Playwright would write the file and
 * fail the test, leaving an unreviewed baseline in the tree.
 */
export function visualBaselineSkipReason({
  name,
  platform,
  updateSnapshots,
  baselineExists,
}: BaselineCheck): string | null {
  if (baselineExists) return null;
  if (updateSnapshots === "changed" || updateSnapshots === "all") return null;
  return `No ${platform} baseline for "${name}". Generate one on this platform with: pnpm test:visual --update-snapshots`;
}
