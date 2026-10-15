import type { Ref } from "react";
import { cn } from "@/lib/utils";

interface HeadlineProps {
  /** The question, shown smaller, on its own line: «¿En busca de coche?». */
  question: string;
  /** The giant `lime` punchline, on its own line, no final punctuation: «Mira el mapa». */
  punchline: string;
  /** `h1` where this is the page's only heading; `h2` under a page's own `h1`. */
  level?: "h1" | "h2";
  /** The heading's own size classes — every caller sets its own (the hero size, or EmptyState's smaller `empty-title` pair). */
  className: string;
  /** Set where a caller moves the focus to the heading (an emptied list, SAVED-18): it then takes focus from script only. */
  ref?: Ref<HTMLHeadingElement>;
}

// docs/design/system/components/Headline/README.md: the brand's titular
// headline — a question in `text` at 0.56 of the size, then the enormous
// punchline in `lime`, each on its own line, never a single word alone on
// one. Used at hero size by the landing and sign-in pages
// (docs/specs/redesign-entry.md, ENTRY-1, ENTRY-9) and, via `className`, at
// `empty-title` size inside EmptyState.
export function Headline({
  question,
  punchline,
  level: Heading = "h1",
  className,
  ref,
}: HeadlineProps) {
  return (
    <Heading
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      className={cn("m-0 font-display font-black text-balance uppercase", className)}
    >
      <span className="mb-headline-gap block text-headline-setup">{question}</span>
      <span className="block text-lime">{punchline}</span>
    </Heading>
  );
}
