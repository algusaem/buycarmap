import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string | null | undefined;
  email: string;
  /** 42px on desktop; on the phone 36px drawn inside a 44px hit area. */
  size: "desktop" | "phone";
  /** On `/account` the avatar, not a section, is the current page (HEAD-4). */
  current: boolean;
}

/** HEAD-9: the upper-case first letter of the name, or of the email when there is no name. */
export function initialOf(name: string | null | undefined, email: string) {
  return (name || email).charAt(0).toUpperCase();
}

// docs/design/system/components/HeaderNav/README.md › Avatar: violet with the
// initial in Unbounded 800 on on-violet, linking to the account page; on that
// page it carries the current ring (`shadow-current`, `-sm` on the phone).
export function Avatar({ name, email, size, current }: AvatarProps) {
  const t = useTranslations();
  const initial = initialOf(name, email);
  const circle = cn(
    "flex items-center justify-center rounded-pill bg-violet font-display font-extrabold text-on-violet",
    size === "desktop" ? "size-10.5 text-[15px]" : "size-9 text-[13px]",
    current && (size === "desktop" ? "shadow-current" : "shadow-current-sm"),
  );

  return (
    <Link
      href="/account"
      aria-label={t("nav.account")}
      aria-current={current ? "page" : undefined}
      className={cn(
        "rounded-pill",
        size === "desktop" ? circle : "flex size-11 items-center justify-center",
      )}
    >
      {size === "desktop" && initial}
      {size === "phone" && <span className={circle}>{initial}</span>}
    </Link>
  );
}
