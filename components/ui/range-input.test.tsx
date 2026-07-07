import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RangeInput } from "./range-input";

// RangeInput is controlled: without a parent holding the value, each keystroke
// resets to "" and only the last digit is emitted. This harness mirrors the
// real parent so typing accumulates.
function Harness({
  onMin = vi.fn(),
  onMax = vi.fn(),
  initialMax,
}: {
  onMin?: (v: number | undefined) => void;
  onMax?: (v: number | undefined) => void;
  initialMax?: number;
}) {
  const [minValue, setMin] = useState<number | undefined>(undefined);
  const [maxValue, setMax] = useState<number | undefined>(initialMax);
  return (
    <RangeInput
      label="Precio"
      minPlaceholder="Min"
      maxPlaceholder="Max"
      minValue={minValue}
      maxValue={maxValue}
      onMinChange={(v) => {
        setMin(v);
        onMin(v);
      }}
      onMaxChange={(v) => {
        setMax(v);
        onMax(v);
      }}
    />
  );
}

describe("RangeInput", () => {
  it("emits the accumulated parsed number from the min field", async () => {
    const onMin = vi.fn();
    render(<Harness onMin={onMin} />);

    await userEvent.type(screen.getByPlaceholderText("Min"), "15000");

    expect(onMin).toHaveBeenLastCalledWith(15000);
    expect(screen.getByPlaceholderText("Min")).toHaveValue(15000);
  });

  it("emits undefined when a field is cleared", async () => {
    const onMax = vi.fn();
    render(<Harness onMax={onMax} initialMax={20000} />);

    await userEvent.clear(screen.getByPlaceholderText("Max"));

    expect(onMax).toHaveBeenLastCalledWith(undefined);
  });
});
