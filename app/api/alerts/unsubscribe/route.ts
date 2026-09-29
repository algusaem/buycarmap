import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashUnsubscribeToken } from "@/lib/alerts/unsubscribe-token";

// Followed from an inbox, so it must work with no session — it deliberately
// never calls getCurrentUser(). The token is the credential.
//
// Every outcome answers identically. A different response for an unknown token
// would turn this into an oracle for which tokens exist, which is the same
// enumeration resistance the auth surfaces hold to.

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (token) {
    try {
      // Deactivates rather than deletes: the matches page still renders, and
      // re-enabling the alert loses no history. Only deleting the alert
      // releases its criteria set.
      await prisma.alert.updateMany({
        where: { unsubscribeTokenHash: hashUnsubscribeToken(token) },
        data: { active: false },
      });
    } catch {
      // Answer the same way regardless — see above.
    }
  }

  return new NextResponse(
    "<!doctype html><meta charset=utf-8><title>Unsubscribed</title>" +
      "<p>If that link was valid, the alert is now paused and you will receive no more emails about it.</p>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
