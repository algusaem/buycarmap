import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { Footer } from "@/components/Footer";
import { LoginHeadline } from "@/components/auth/LoginHeadline";
import { isGoogleConfigured } from "@/lib/app-config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("auth.signIn")} · ${t("meta.title")}` };
}

const ILLUSTRATION = "/illus/by-my-car-lime.svg";

// docs/specs/redesign-entry.md (ENTRY-9, ENTRY-19). AuthBackground,
// BrandHeader and LegalNotice are dropped here only — the other auth pages
// keep them until F7 (the spec's "Out of scope"). A plain, synchronous
// Server Component — the translated copy lives in LoginHeadline and
// LoginForm.
//
// Desktop, from 1440px wide, follows docs/design/canvas/R3-login.dc.html's
// 1440×900 frame: the headline and the 440px panel side by side, 48px from
// the sides and 80px apart. The left block — headline, line and the
// illustration 620px wide, its drawn content 30px under the line — is one
// flex sibling of the panel, so both stay centred on the same line whatever
// height the panel takes (ENTRY-28); the arrow runs from the «Guárdalo» line
// to the «o» between the two buttons.
//
// Under 1440px the page takes the phone frame's composition (ENTRY-19,
// ENTRY-25, ENTRY-27): everything stacked 18px apart, the illustration in
// the flow with its drawn content 24px under the last line, whole and
// centred — 20px from the sides on a phone, and one centred 440px column
// from 1024px wide, with the desktop header and footer. From 1024px wide the
// illustration only takes the room left (ENTRY-29); the page scrolls only
// when the form itself does not fit.
export default function LoginPage() {
  // The footer sits outside <main>, as app/page.tsx's does: a footer scoped
  // to main is not the page's contentinfo landmark. Both scroll together, so
  // the illustration is never cut by the edge of a scrolling box.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-auto bg-bg">
      <main className="relative isolate flex flex-1 flex-col 3xl:min-h-193">
        <div className="mx-auto flex w-full max-w-360 flex-1 flex-col lg:w-110 3xl:w-full 3xl:px-12">
          <div className="relative flex flex-1 flex-col gap-4.5 px-5 pt-4.5 lg:px-0 3xl:flex-row 3xl:items-center 3xl:gap-20 3xl:pt-0 3xl:pb-3">
            <LoginHeadline />

            <LoginForm isGoogleConfigured={isGoogleConfigured} />

            {/* The arrow from the «Guárdalo» line to the «o», on the board's own
              curve (M615 295 C 740 295 780 560 862 566, drawn in a 253×282px
              box from 613, 293 and mapped onto the 280×140 viewBox), anchored
              to the panel so it always ends 22px short of it. */}
            <svg
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
              <path
                vectorEffect="non-scaling-stroke"
                d="M262.85 131.26 L 277.79 135.53 L 261.74 138.86"
              />
            </svg>

            {/* docs/specs/redesign-entry.md (ENTRY-19, ENTRY-26, ENTRY-27,
              ENTRY-29, ENTRY-30, Contracts › Illustrations):
              by-my-car-lime.svg, served same-origin under public/illus/,
              hidden from assistive technology. Under 1440px it is in the
              flow, whole at its 3:2 proportions, pulled up by the file's
              empty top band so its drawn content starts 24px under «Créala»
              (the slot cancels the column's 18px gap and holds the 24px
              itself, so it adds no height once it has no room). 350px at
              most on a phone. From 1024px wide the slot takes the height
              left down to the footer (a size container), the image the
              largest size that fits, up to 440px, and it is not shown when
              under 150px of drawing fits. From 1440px wide the illustration
              is LoginHeadline.tsx's, in the left block. */}
            <div
              aria-hidden="true"
              className="pointer-events-none -mt-4.5 flex justify-center lg:@container-size/illus lg:min-h-0 lg:flex-1 3xl:hidden"
            >
              <div className="mt-6 w-full max-w-87.5 lg:w-login-illus lg:max-w-none login-illus-hidden:hidden">
                <Image
                  src={ILLUSTRATION}
                  alt=""
                  width={750}
                  height={500}
                  preload
                  className="-mt-illus-band-car block h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
