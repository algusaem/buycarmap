import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginHeadline } from "@/components/auth/LoginHeadline";
import { ACCESS_ROW_CLASSES, AccessArrow, AccessShell } from "@/components/auth/AccessLayout";
import { isGoogleConfigured } from "@/lib/app-config";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("auth.signIn")} · ${t("meta.title")}` };
}

const ILLUSTRATION = "/illus/by-my-car-lime.svg";

// docs/specs/redesign-entry.md (ENTRY-9, ENTRY-19). The shell, headline,
// panel and arrow are components/auth/AccessLayout.tsx's, shared with the F7
// access pages. A plain, synchronous Server Component — the translated copy lives in LoginHeadline and
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
  return (
    <AccessShell>
      <div className={cn(ACCESS_ROW_CLASSES, "gap-4.5 pt-4.5")}>
        <LoginHeadline />

        <LoginForm isGoogleConfigured={isGoogleConfigured} />

        {/* The arrow from the «Guárdalo» line to the «o». */}
        <AccessArrow />

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
    </AccessShell>
  );
}
