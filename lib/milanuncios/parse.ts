import {
  MilanunciosAd,
  MilanunciosPagination,
  MilanunciosSearchResponse,
} from "@/interfaces/milanuncios";

// Milanuncios has no JSON search API. The cars search page is server-rendered
// HTML that embeds the results as:
//   window.__INITIAL_PROPS__ = JSON.parse("{…escaped json…}")
// The listings live at adListPagination.adList.ads and the page metadata at
// adListPagination.pagination. This extracts that node from the raw HTML so the
// proxy route can hand the client clean JSON.

const MARKER = "window.__INITIAL_PROPS__";
const PARSE_CALL = "JSON.parse(";

const EMPTY_PAGINATION: MilanunciosPagination = {
  page: 1,
  resultsPerPage: 0,
  totalAds: 0,
  totalPages: 0,
};

// The embedded props are external, scraped data — only the node we consume is
// typed, and every field is read defensively via optional chaining.
interface InitialProps {
  adListPagination?: {
    adList?: { ads?: MilanunciosAd[] };
    pagination?: Partial<MilanunciosPagination>;
  };
}

// The argument to JSON.parse is a double-quoted JS string literal whose content
// is itself JSON. Read that literal (respecting backslash escapes) so it can be
// decoded without eval.
function readStringLiteral(html: string, from: number): string | null {
  const open = html.indexOf('"', from);
  if (open === -1) return null;

  for (let i = open + 1; i < html.length; i++) {
    if (html[i] === "\\") {
      i++;
      continue;
    }
    if (html[i] === '"') return html.slice(open, i + 1);
  }
  return null;
}

export function extractInitialProps(html: string): MilanunciosSearchResponse {
  const empty: MilanunciosSearchResponse = {
    ads: [],
    pagination: EMPTY_PAGINATION,
  };

  const markerIndex = html.indexOf(MARKER);
  if (markerIndex === -1) return empty;

  const parseIndex = html.indexOf(PARSE_CALL, markerIndex);
  if (parseIndex === -1) return empty;

  const literal = readStringLiteral(html, parseIndex + PARSE_CALL.length);
  if (!literal) return empty;

  // Double decode: the literal is a JSON string (yielding the inner JSON text),
  // which then parses into the props object.
  let props: InitialProps;
  try {
    const inner = JSON.parse(literal) as string;
    props = JSON.parse(inner) as InitialProps;
  } catch {
    return empty;
  }

  const node = props.adListPagination;
  const ads = Array.isArray(node?.adList?.ads) ? node.adList.ads : [];

  return {
    ads,
    pagination: { ...EMPTY_PAGINATION, ...(node?.pagination ?? {}) },
  };
}
