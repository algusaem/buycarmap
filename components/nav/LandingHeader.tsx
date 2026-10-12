import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DesktopRegion, MainNav, PhoneRegion, PhoneTextLink, TextLink } from "./HeaderParts";
import { LanguageControl } from "./LanguageControl";
import { Wordmark } from "./Wordmark";

// HeaderNav README › Landing (HEAD-5, HEAD-7): signed out, the language,
// «Entrar» (ghost) and «Crear cuenta» (small primary, 11px 20px at 15px) on
// desktop, and the language and «Entrar» on the phone. While the session
// resolves (HEAD-11) the same boxes stand in for both, offering nothing. The
// signed-in landing is the pages header (PagesHeader with `open`).
export function LandingHeader({ pending }: { pending: boolean }) {
  const t = useTranslations();

  return (
    <>
      <DesktopRegion open>
        <Wordmark size="desktop" />
        <MainNav className="gap-2.5">
          <LanguageControl />
          {pending && (
            <>
              <Skeleton className="h-10.5 w-21 rounded-pill" />
              <Skeleton className="h-11 w-36 rounded-pill" />
            </>
          )}
          {!pending && (
            <>
              <TextLink href="/login">{t("nav.signIn")}</TextLink>
              <Button asChild variant="primary" size="pad-15">
                <Link href="/register">{t("nav.createAccount")}</Link>
              </Button>
            </>
          )}
        </MainNav>
      </DesktopRegion>

      <PhoneRegion open>
        <Wordmark size="phone" />
        <MainNav>
          <LanguageControl />
          {pending && <Skeleton className="h-11 w-12 rounded-pill" />}
          {!pending && <PhoneTextLink href="/login">{t("nav.signIn")}</PhoneTextLink>}
        </MainNav>
      </PhoneRegion>
    </>
  );
}
