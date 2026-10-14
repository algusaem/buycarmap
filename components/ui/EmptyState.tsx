import type { ReactNode } from "react";

interface EmptyStateProps {
  /** The headline's question, «¿Nada por aquí?». */
  question: string;
  /** The headline's punchline, in lime: «Amplía el radio». */
  punchline: string;
  /** One line in `text-muted` under the headline. */
  line: string;
  /** The actions: one primary at most, and an optional second. */
  children: ReactNode;
  /** The headline's level: `h2` under a page's own heading, `h1` where it is the page's only one. */
  headingLevel?: "h1" | "h2";
}

// docs/design/system/components/EmptyState/README.md: what a list shows when
// it has nothing or a load fails, inside the real screen. A question-and-
// punchline headline (Headline with `empty-title`: 48px on desktop, 28px with
// a 1.06 line height on a phone), a line in `text-muted` and the actions, 22px
// apart on desktop and 16px on a phone. No icon above it.
export function EmptyState({
  question,
  punchline,
  line,
  children,
  headingLevel: Heading = "h2",
}: EmptyStateProps) {
  return (
    <div className="flex max-w-155 flex-col gap-4 lg:gap-5.5">
      <Heading className="m-0 font-display text-empty-title-mobile font-black text-balance uppercase lg:text-empty-title">
        <span className="mb-headline-gap block text-headline-setup">{question}</span>
        <span className="block text-lime">{punchline}</span>
      </Heading>
      <p className="m-0 text-body-15 text-text-muted lg:text-empty-line">{line}</p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}
