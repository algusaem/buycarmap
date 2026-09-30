import { withRequestContext } from "@/lib/request-context";

// PLAT-19 (docs/specs/core-platform.md): a liveness check. It never touches
// the database — that is what /api/health/db is for — so it stays fast and
// answers even when the database is down.
export async function GET() {
  return withRequestContext(async () =>
    Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }),
  );
}
