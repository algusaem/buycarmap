import { useTranslations } from "next-intl";
import { AccessHeadline } from "./AccessLayout";

// docs/specs/redesign-entry.md (ENTRY-9): the sign-in page's own headline
// and tagline, with the illustration from 1440px wide (ENTRY-28, ENTRY-30).
// A Server Component: it only renders translated text, which next-intl's
// `useTranslations` serves in a non-async Server Component. The composition
// is AccessLayout.tsx's, shared with the F7 access pages. Under 1440px the
// illustration is app/login/page.tsx's, under the form.
export function LoginHeadline() {
  const t = useTranslations();

  return (
    <AccessHeadline
      question={t("auth.headline")}
      punchline={t("auth.headlineHighlight")}
      line={t("auth.tagline")}
      illustration
    />
  );
}
