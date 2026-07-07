import { NextRequest, NextResponse } from "next/server";

const COCHESNET_URL = "https://web.gw.coches.net/models";

export async function GET(request: NextRequest) {
  const makeId = request.nextUrl.searchParams.get("makeId");

  if (!makeId) {
    return NextResponse.json(
      { error: "makeId parameter is required" },
      { status: 400 },
    );
  }

  const url = new URL(COCHESNET_URL);
  url.searchParams.set("makeId", makeId);

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

  const data = await response.json();
  return NextResponse.json(data);
}
