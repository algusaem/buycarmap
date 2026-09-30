import { type NextRequest, NextResponse } from "next/server";
import { withRequestContext } from "@/lib/request-context";

const COCHESNET_URL = "https://web.gw.coches.net/models";

export async function GET(request: NextRequest) {
  return withRequestContext(async () => {
    const makeId = request.nextUrl.searchParams.get("makeId");

    if (!makeId) {
      return NextResponse.json({ error: "makeId parameter is required" }, { status: 400 });
    }

    const url = new URL(COCHESNET_URL);
    url.searchParams.set("makeId", makeId);

    // A rejected fetch — DNS, reset, timeout — is routine against an upstream we
    // do not control. Without this it escapes the handler and Next answers with
    // an unhandled 500 instead of the `{ error }` shape every caller expects.
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "X-Schibsted-Tenant": "coches",
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Coches.net API error: ${response.status}` },
          { status: response.status },
        );
      }

      const data: unknown = await response.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "Coches.net request failed" }, { status: 502 });
    }
  });
}
