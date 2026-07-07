import { cn } from "@/lib/utils";

interface SourceStyle {
  label: string;
  className: string;
}

// Each source gets its brand colour so the origin is recognisable at a glance.
// Wallapop = turquoise, coches.net = orange-red. Falls back to a neutral chip.
const SOURCE_STYLES: Record<string, SourceStyle> = {
  Wallapop: { label: "Wallapop", className: "bg-[#13C1AC] text-white" },
  "Coches.net": { label: "coches.net", className: "bg-[#FF5A1F] text-white" },
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const style = SOURCE_STYLES[source] ?? {
    label: source,
    className: "bg-background/80 text-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold leading-none shadow-sm backdrop-blur-sm",
        style.className,
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-white/90"
      />
      {style.label}
    </span>
  );
}
