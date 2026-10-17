import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme's named type styles and spacing (app/globals.css › @theme), so
// `text-body-15` merges as a font size, overriding `text-sm`, instead of being
// read as a colour that drops `text-text-muted`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "hero",
        "hero-setup",
        "hero-mobile",
        "empty-title",
        "page-title",
        "page-title-mobile",
        "form-title",
        "legal-h1",
        "legal-h2",
        "count",
        "price",
        "wordmark",
        "button-display",
        "lead",
        "lead-mobile",
        "body",
        "body-15",
        "legal-body",
        "card-title",
        "account-name",
        "label",
        "field-label",
        "meta",
        "small",
        "caption",
        "overline",
        "section-label",
        "count-mobile",
        "empty-title-mobile",
        "headline-setup",
        "box-label",
        "tab-label",
        "pin",
        "sheet-title",
        "empty-line",
        "alert-name",
        "alert-title",
      ],
      spacing: [
        "tab-clearance",
        "sheet-bottom",
        "float-top",
        "float-left",
        "float-right",
        "sheet-full-top",
        "sheet-above-tabs",
        "sheet-middle",
        "sheet-footer",
        "sheet-full-bottom",
        "headline-gap",
        "filters-max",
        "safe-top",
        "safe-bottom",
        "sheet-max",
        "dialog-max",
        "pill-arrow-left",
        "pill-arrow-width",
        "illus-band-vehicle",
        "illus-band-car",
        "landing-illus-drawn",
        "landing-illus",
        "login-illus",
        "login-illus-drawn-desktop",
        "pin-14500-top",
        "pin-14500-left",
        "pin-9400-top",
        "pin-9400-left",
        "pin-18900-top",
        "pin-18900-left",
        "pin-16500-top",
        "pin-16500-left",
        "pin-11900-top",
        "pin-11900-left",
        "toast-centre",
      ],
    },
    // tailwind-merge has no theme key for border widths, so the 1.5px
    // `border-thin` joins the width group by name.
    classGroups: {
      "border-w": [{ border: ["thin"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
