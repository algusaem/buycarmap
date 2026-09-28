import { type NextRequest, NextResponse } from "next/server";

const WALLAPOP_URL = "https://api.wallapop.com/api/v3/search/section";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${WALLAPOP_URL}?${params}`;

  // A rejected fetch — DNS, reset, timeout — is routine against an upstream we
  // do not control. Without this it escapes the handler and Next answers with
  // an unhandled 500 instead of the `{ error }` shape every caller expects.
  try {
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

    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Wallapop request failed" }, { status: 502 });
  }
}
