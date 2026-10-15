import "react";

// The CSS custom properties a component sets inline, typed so a style object
// is checked with `satisfies CSSProperties` rather than cast.
declare module "react" {
  interface CSSProperties {
    /** Sonner's toast width (components/Toaster.tsx). */
    "--width"?: string;
  }
}
