import { Input } from "@/components/ui/input";

function parseNumericInput(value: string): number | undefined {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function RangeInput({
  label,
  minPlaceholder,
  maxPlaceholder,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  min = 0,
}: {
  label: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  min?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          placeholder={minPlaceholder}
          value={minValue ?? ""}
          onChange={(e) => onMinChange(parseNumericInput(e.target.value))}
          className="h-10 w-28 border-border/50 bg-card/50 font-mono text-sm"
        />
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          placeholder={maxPlaceholder}
          value={maxValue ?? ""}
          onChange={(e) => onMaxChange(parseNumericInput(e.target.value))}
          className="h-10 w-28 border-border/50 bg-card/50 font-mono text-sm"
        />
      </div>
    </div>
  );
}
