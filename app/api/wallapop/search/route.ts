import { NextRequest, NextResponse } from "next/server";

const WALLAPOP_URL = "https://api.wallapop.com/api/v3/search/section";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${WALLAPOP_URL}?${params}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-deviceos": "0",
      "x-appversion": "85000",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Wallapop API error: ${response.status}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
