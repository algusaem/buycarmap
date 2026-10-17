import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import * as motion from "motion/react-client";
import { Footer } from "@/components/Footer";
import { Headline } from "@/components/ui/Headline";
import { crossFade } from "@/lib/animations";
import { focusOnMount } from "@/lib/focus";
import { cn } from "@/lib/utils";

const ILLUSTRATION = "/illus/by-my-car-lime.svg";

// The access pages' composition (docs/specs/redesign-entry.md, ENTRY-19 to
// ENTRY-30, for /login; docs/specs/redesign-pages.md, PAGES-1, PAGES-7 and
// PAGES-75, for /register, /verify-email, /confirm-email, /forgot-password
// and /reset-password). No hooks, so a Server Component (the pages) and a
// Client Component (the forms, which swap their state) both render it.
//
// Desktop, from 1440px wide: the headline and its line on the left, the
// 440px panel on the right, 48px from the sides and 80px apart, both centred
// on one line. From 1024px to 1439px: one centred 440px column with the
// desktop header and the footer, no panel. Under 1024px: the phone
// composition, directly on the page background.

interface AccessShellProps {
  children: ReactNode;
}

/**
 * The page around the composition: one scrolling box holding `<main>` and the
 * footer. The footer sits outside `<main>`, as app/page.tsx's does: a footer
 * scoped to main is not the page's contentinfo landmark. Both scroll
 * together, so an illustration is never cut by the edge of a scrolling box.
 */
export function AccessShell({ children }: AccessShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-auto bg-bg">
      <main className="relative isolate flex flex-1 flex-col 3xl:min-h-193">
        <div className="mx-auto flex w-full max-w-360 flex-1 flex-col lg:w-110 3xl:w-full 3xl:px-12">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * The access pages' composition row, shared by `AccessBody` and /login's own
 * row (app/login/page.tsx): stacked with 20px sides on a phone, the 440px
 * column from 1024px, and from 1440px the headline and the panel side by side,
 * 80px apart and centred on one line. Each adds its own gap and top padding.
 */
export const ACCESS_ROW_CLASSES =
  "relative flex flex-1 flex-col px-5 lg:px-0 3xl:flex-row 3xl:items-center 3xl:gap-20 3xl:pt-0 3xl:pb-3";

interface AccessBodyProps {
  /**
   * `form`: the fields flow from the top, 14px apart on a phone
   * (`F7-registro-estados`, `F7-contrasena-estados`). `actions`: a state with
   * buttons only — the headline and its line 22px apart from 30px down, the
   * buttons pinned to the bottom of a phone screen (`F7-confirmar-estados`).
   */
  variant: "form" | "actions";
  /**
   * False for a state the page opens with rather than one a form gives way to
   * (an expired link with no token): rendered visible from the server, with no
   * fade-in before hydration.
   */
  fadeIn?: boolean;
  children: ReactNode;
}

/**
 * One state of an access page: the headline, the panel and, on /register, the
 * arrow. A form that gives way to another state renders a new body under
 * `AnimatePresence`, so the two cross-fade (RULES.md §17).
 */
export function AccessBody({ variant, fadeIn = true, children }: AccessBodyProps) {
  return (
    <motion.div
      {...crossFade}
      {...(!fadeIn && { initial: false })}
      className={cn(
        ACCESS_ROW_CLASSES,
        "lg:gap-4.5 lg:pt-4.5",
        variant === "form" ? "gap-3.5 pt-3.5" : "gap-5.5 pt-7.5",
      )}
    >
      {children}
    </motion.div>
  );
}

interface AccessHeadlineProps {
  question: string;
  punchline: string;
  line: string;
  /** The form pages drop the line on a phone (PAGES-9, PAGES-20, PAGES-22). */
  lineFromLaptop?: boolean;
  /** /login and /register only: the illustration under the line, from 1440px wide. */
  illustration?: boolean;
  /** The section's own gap below 1440px, where a page's rhythm differs from /login's 18px. */
  className?: string;
  /** A state another gave way to: the focus moves to its headline as it mounts (PAGES-76). */
  focusHeading?: boolean;
}

/**
 * The headline (`Headline`, the page's `h1`) and its line. Like the
 * landing's, the headline's box is trimmed to its cap height and baseline
 * (the board's `.display` class), which sets the rhythm below it.
 *
 * From 1440px wide the headline takes the room the 440px panel leaves, and
 * steps down the Headline's own sizes when that room is short, so the
 * question stays on one line and nothing runs under the panel: `hero` from a
 * 672px column (the board's is 758px), `empty-title` from 384px. Under 1440px
 * it keeps the phone's sizes, as the 1024 boards do (ENTRY-25).
 *
 * With `illustration`, from 1440px wide this section is also the left block
 * of ENTRY-28 and ENTRY-30: under the line, 30px down, the illustration 620px
 * wide, reaching the page's left edge (48px out), in a box as tall as its
 * drawn content (redesign-entry.md, Contracts › Illustrations), so the block
 * is centred on the panel by what is drawn, not by the file's empty bands.
 * Hidden from assistive technology.
 */
export function AccessHeadline({
  question,
  punchline,
  line,
  lineFromLaptop = false,
  illustration = false,
  className,
  focusHeading = false,
}: AccessHeadlineProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4.5 3xl:@container 3xl:min-w-0 3xl:flex-1 3xl:gap-7.5",
        className,
      )}
    >
      <Headline
        question={question}
        punchline={punchline}
        ref={focusHeading ? focusOnMount : undefined}
        className="text-box-trim text-hero-mobile 3xl:@sm:text-empty-title 3xl:@2xl:text-hero"
      />
      <p
        className={cn(
          "m-0 text-lead-mobile text-text-muted 3xl:max-w-140 3xl:text-lead",
          lineFromLaptop && "hidden lg:block",
        )}
      >
        {line}
      </p>
      {illustration && (
        <div
          data-art-layer
          aria-hidden="true"
          className="pointer-events-none -ml-12 hidden h-login-illus-drawn-desktop w-155 3xl:block"
        >
          <Image
            src={ILLUSTRATION}
            alt=""
            width={750}
            height={500}
            className="-mt-illus-band-car block h-auto w-full"
          />
        </div>
      )}
    </section>
  );
}

interface AccessPanelProps {
  /** The panel's title, shown from 1440px wide only (PAGES-1: no panel title under it). */
  title: string;
  /** /login's OAuth banner, above the title. */
  notice?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The access form panel (`radius-panel`, `surface`, 32px padding, 440px of
 * content) from 1440px wide; under it, the same content directly on the page
 * background. Every piece sits 18px from the next.
 */
export function AccessPanel({ title, notice, className, children }: AccessPanelProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4.5 3xl:w-126.5 3xl:shrink-0 3xl:rounded-panel 3xl:border 3xl:border-line 3xl:bg-surface 3xl:p-8",
        className,
      )}
    >
      {notice}
      <h2 className="m-0 hidden font-display text-form-title font-extrabold uppercase 3xl:block">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * The lime arrow from the headline's line to the panel's «o», from 1440px
 * wide, on the board's own curve (R3-login and F0-registro: M615 295 C 740
 * 295 780 560 862 566, drawn in a 253×282px box from 613, 293 and mapped onto
 * the 280×140 viewBox), anchored to the panel so it always ends 22px short of
 * it. Rendered inside an `AccessBody` (or /login's row), its positioned box.
 */
export function AccessArrow() {
  return (
    <svg
      data-access-arrow
      aria-hidden="true"
      viewBox="0 0 280 140"
      preserveAspectRatio="none"
      className="pointer-events-none absolute top-1/2 right-131.5 -mt-41.75 hidden h-70.5 w-63.25 overflow-visible text-lime 3xl:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        vectorEffect="non-scaling-stroke"
        d="M2.21 0.99 C 140.55 0.99 184.82 132.55 275.57 135.53"
      />
      <path vectorEffect="non-scaling-stroke" d="M262.85 131.26 L 277.79 135.53 L 261.74 138.86" />
    </svg>
  );
}

/**
 * An inline link of the access pages, underlined, with a 44px hit area on a
 * phone (PAGES-8) drawn by a pseudo-element, so the line keeps its drawn
 * height: AccessLink's, and /register's legal notice and «Entra».
 */
export const ACCESS_LINK_CLASSES =
  "inline-flex items-center justify-center underline transition-colors before:absolute before:size-11 hover:text-lime 3xl:before:size-6";

interface AccessLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * A text link of the access pages («Entrar», «Volver a entrar»): 14px weight
 * 700 in `text`, centred, on its own line.
 */
export function AccessLink({ href, children }: AccessLinkProps) {
  return (
    <p className="m-0 text-center text-label">
      <Link href={href} className={cn(ACCESS_LINK_CLASSES, "font-bold text-text")}>
        {children}
      </Link>
    </p>
  );
}

interface AccessStateProps {
  question: string;
  punchline: string;
  line: string;
  /** The panel's title, from 1440px wide. */
  title: string;
  /** A line in the panel above the actions, from 1440px wide only (PAGES-13, PAGES-17). */
  hint?: string;
  /** /register's «check your inbox» keeps the illustration from 1440px wide (PAGES-11). */
  illustration?: boolean;
  /** Reached from another state: the focus moves to the headline (PAGES-76). */
  focusHeading?: boolean;
  /** False for a state the page opens with: no fade-in (AccessBody). */
  fadeIn?: boolean;
  /** The state's buttons and links. */
  children: ReactNode;
}

/** The expired-link state of /verify-email, /confirm-email and /reset-password (PAGES-16, PAGES-19, PAGES-24). */
export interface LinkExpiredProps {
  /**
   * Reached from the form, rather than opened with no token: it fades in and
   * the focus moves to the headline. Opened with the page, it renders visible
   * from the server.
   */
  focusHeading?: boolean;
}

/**
 * A state of an access page with actions and no fields: confirm, confirmed,
 * check your inbox, the expired link (`F7-confirmar-estados`,
 * `F7-contrasena-estados`, `F7-registro-estados`). On a phone the actions
 * sit at the bottom of the screen, 12px apart and 24px over its edge.
 */
export function AccessState({
  question,
  punchline,
  line,
  title,
  hint,
  illustration = false,
  focusHeading = false,
  fadeIn = true,
  children,
}: AccessStateProps) {
  return (
    <AccessBody variant="actions" fadeIn={fadeIn}>
      <AccessHeadline
        question={question}
        punchline={punchline}
        line={line}
        illustration={illustration}
        focusHeading={focusHeading}
        className="gap-5.5 lg:gap-4.5"
      />
      <AccessPanel title={title} className="max-lg:mt-auto max-lg:mb-6 max-lg:gap-3">
        {hint && <p className="m-0 hidden text-body text-text-muted 3xl:block">{hint}</p>}
        {children}
      </AccessPanel>
    </AccessBody>
  );
}
