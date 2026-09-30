import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { withRequestContext } from "@/lib/request-context";
import { runAlerts } from "@/server/alerts/service";

// The alert runner. Called by the GitHub Actions cron, K jobs in parallel.
//
// A route handler rather than a server action because the caller is a machine,
// not a user — the "prefer server actions" rule is about mutations from the UI.
// Authorised by a shared secret, never by getCurrentUser().
//
// One invocation does three things in order: enqueue what is due, drain a
// bounded slice of the queue, then deliver whatever is pending. The run itself
// lives in server/alerts/service.ts; see docs/specs/alerts.md › Decisions and
// rationale.

function isAuthorised(request: NextRequest): boolean {
  const secret = env.ALERTS_CRON_SECRET;
  if (!secret) return false;

  const offered = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!offered) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(secret);
  // Length must match before timingSafeEqual, which throws on mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  return withRequestContext(async () => {
    if (!isAuthorised(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const summary = await runAlerts(new Date());

    return NextResponse.json(summary);
  });
}
