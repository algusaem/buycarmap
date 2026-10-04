import type { ReactElement } from "react";
import { render } from "@react-email/render";

// Renders a react-email component to HTML and plain text
// (docs/specs/core-integrations.md, INT-13).

export interface RenderedEmailOutput {
  html: string;
  text: string;
}

export async function renderEmail(element: ReactElement): Promise<RenderedEmailOutput> {
  const [html, text] = await Promise.all([
    render(element),
    // html-to-text uppercases headings by default; the plain-text copy keeps the
    // heading as written, as the old string templates did.
    render(element, {
      plainText: true,
      htmlToTextOptions: { selectors: [{ selector: "h1", options: { uppercase: false } }] },
    }),
  ]);

  return { html, text };
}
