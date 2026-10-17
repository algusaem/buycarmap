"use client";

import { PageStateError } from "@/components/ui/PageStateError";

// docs/specs/redesign-pages.md (PAGES-68; amends PLAT-14); F7-no-existe. The
// error boundary of every route with no error file of its own — the access
// pages, the legal pages, `/` and `/login`: the page-error state of PAGES-57,
// «Reintentar» and «Volver al mapa», under the header of the route that failed,
// which the root layout keeps drawing. Its sides follow that header as the
// not-found page's do (`session`).
interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  return <PageStateError sides="session" error={error} reset={reset} />;
}
