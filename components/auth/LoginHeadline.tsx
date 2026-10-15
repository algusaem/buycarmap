import Image from "next/image";
import { useTranslations } from "next-intl";
import { Headline } from "@/components/ui/Headline";

const ILLUSTRATION = "/illus/by-my-car-lime.svg";

// docs/specs/redesign-entry.md (ENTRY-9): the sign-in page's own headline
// and tagline. A Server Component: it only renders translated text, which
// next-intl's `useTranslations` serves in a non-async Server Component.
// Like the landing's, the headline's box is trimmed to its cap height and
// baseline (the board's `.display` class), which sets the 18px (phone) and
// 30px (desktop) rhythm below it.
//
// From 1440px wide the headline takes the room the 440px panel leaves, and
// steps down the Headline's own sizes when that room is short, so the
// question stays on one line and nothing runs under the panel: `hero` from
// a 672px column (the board's is 758px), `empty-title` from 384px. Under
// 1440px it keeps the phone's sizes, as the 1024 board does (ENTRY-25).
//
// From 1440px wide this section is also the left block of ENTRY-28 and
// ENTRY-30: under the line, 30px down, the illustration 620px wide, reaching
// the page's left edge (48px out), in a box as tall as its drawn content
// (Contracts › Illustrations) so the block is centred on the panel by what is
// drawn, not by the file's empty bands. Hidden from assistive technology.
// Under 1440px the illustration is app/login/page.tsx's, under the form.
export function LoginHeadline() {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-4.5 3xl:@container 3xl:min-w-0 3xl:flex-1 3xl:gap-7.5">
      <Headline
        question={t("auth.headline")}
        punchline={t("auth.headlineHighlight")}
        className="text-box-trim text-hero-mobile 3xl:@sm:text-empty-title 3xl:@2xl:text-hero"
      />
      <p className="m-0 text-lead-mobile text-text-muted 3xl:max-w-140 3xl:text-lead">
        {t("auth.tagline")}
      </p>
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
    </section>
  );
}
