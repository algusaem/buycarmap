import { cn } from "@/lib/utils";

// Each source's display name, as the design writes it. An unknown source
// falls back to its raw name.
const SOURCE_LABELS: Record<string, string> = {
  Wallapop: "Wallapop",
  "Coches.net": "coches.net",
  Milanuncios: "Milanuncios",
};

/** A source's display name, «coches.net»: the badge's text, and the alert match card's (ALERTUI-8). */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

interface SourceBadgeProps {
  source: string;
  className?: string;
}

// One neutral badge for every source (LOOK-15): a dark scrim chip with the
// source's name in `text`, never a brand colour
// (docs/design/system/README.md › Color; ListingCard/README.md; `caption`
// type style, 12px weight 700).
export function SourceBadge({ source, className }: SourceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill bg-scrim px-2.5 py-1.25 font-sans text-xs font-bold leading-tight text-text",
        className,
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}
