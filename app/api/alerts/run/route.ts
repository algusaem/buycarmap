import { type NextRequest, NextResponse } from "next/server";
import { verifyQstashSignature } from "@/lib/platform/qstash";
import { withRequestContext } from "@/lib/request-context";
import { runAlerts } from "@/server/alerts/service";

// The alert runner. Called by the QStash schedule (scripts/qstash-schedule.mjs),
// drained every five minutes.
//
// A route handler rather than a server action because the caller is a machine,
// not a user — the "prefer server actions" rule is about mutations from the UI.
// Authorised by QStash's own request signature (docs/specs/core-integrations.md,
// INT-7), never by getCurrentUser().
//
// One invocation does three things in order: enqueue what is due, drain a
// bounded slice of the queue, then deliver whatever is pending. The run itself
// lives in server/alerts/service.ts; see docs/specs/alerts.md › Decisions and
// rationale.

export async function POST(request: NextRequest) {
  return withRequestContext(async () => {
    if (!(await verifyQstashSignature(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const summary = await runAlerts(new Date());

    return NextResponse.json(summary);
  });
}
