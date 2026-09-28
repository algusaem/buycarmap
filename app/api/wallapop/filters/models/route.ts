import { type NextRequest, NextResponse } from "next/server";

const WALLAPOP_URL = "https://api.wallapop.com/api/v3/search/filters/model";

export async function GET(request: NextRequest) {
  const brand = request.nextUrl.searchParams.get("brand");

  if (!brand) {
    return NextResponse.json({ error: "brand parameter is required" }, { status: 400 });
  }

  const url = new URL(WALLAPOP_URL);
  url.searchParams.set("category_id", "100");
  url.searchParams.set("brand", brand);

  // A rejected fetch — DNS, reset, timeout — is routine against an upstream we
  // do not control. Without this it escapes the handler and Next answers with
  // an unhandled 500 instead of the `{ error }` shape every caller expects.
  try {
    const response = await fetch(url.toString(), {
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
