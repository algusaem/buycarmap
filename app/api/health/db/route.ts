import { logger } from "@/lib/logger";
import { withRequestContext } from "@/lib/request-context";
import { checkDatabase } from "@/server/health/service";

// PLAT-20 (docs/specs/core-platform.md): a readiness check. Runs one `SELECT
// 1`; the failure detail (host, port, credentials in a connection error)
// never leaves the server, only that the database is unreachable.
export async function GET() {
  return withRequestContext(async () => {
    try {
      await checkDatabase();
      return Response.json(
        { status: "ok", db: "ok" },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      logger.error({ err }, "health db check failed");
      return Response.json(
        { status: "error", db: "unreachable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  });
}
