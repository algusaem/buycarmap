import { NextRequest, NextResponse } from "next/server";

const COCHESNET_URL = "https://web.gw.coches.net/search/listing";

export async function POST(request: NextRequest) {
  const body = await request.text();

  // A rejected fetch — DNS, reset, timeout — is routine against an upstream we
  // do not control. Without this it escapes the handler and Next answers with
  // an unhandled 500 instead of the `{ error }` shape every caller expects.
  try {
    const response = await fetch(COCHESNET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Schibsted-Tenant": "coches",
      },
      body,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Coches.net API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Coches.net request failed" }, { status: 502 });
  }
}
