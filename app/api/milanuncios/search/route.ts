import { type NextRequest, NextResponse } from "next/server";
import { extractInitialProps } from "@/lib/milanuncios/parse";
import { ALL_CARS_SLUG } from "@/lib/milanuncios/taxonomy";

const MILANUNCIOS_BASE = "https://www.milanuncios.com";

// Milanuncios exposes no JSON search API — the cars search page is SSR HTML
// with the results embedded as window.__INITIAL_PROPS__. We fetch that page
// server-side (browser-like headers, since the site gates datacenter IPs behind
// bot protection) and return the extracted listings as JSON. `slug` selects the
// make (path-based); the remaining params pass straight through.
export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  const slug = incoming.get("slug") || ALL_CARS_SLUG;

  const upstream = new URL(`${MILANUNCIOS_BASE}/${slug}/`);
  for (const [key, value] of incoming) {
    if (key === "slug") continue;
    upstream.searchParams.set(key, value);
  }

  let html: string;
  try {
    const response = await fetch(upstream.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Milanuncios error: ${response.status}` },
        { status: response.status },
      );
    }

    html = await response.text();
  } catch {
    return NextResponse.json({ error: "Milanuncios request failed" }, { status: 502 });
  }

  return NextResponse.json(extractInitialProps(html));
}
