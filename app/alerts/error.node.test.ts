import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/redesign-alerts.md (ALERTUI-42): both alert routes' error.tsx
// draw components/alerts/AlertsRouteError.tsx (app/alerts/error.test.tsx and
// app/alerts/[id]/error.test.tsx), and the generic route error they replaced
// is gone. A file-system check, so it runs in the node project.
describe("ALERTUI-42: the alert routes' error state", () => {
  it("ALERTUI-42: components/ui/RouteError.tsx is removed", () => {
    expect(existsSync(join(process.cwd(), "components/ui/RouteError.tsx"))).toBe(false);
  });
});
