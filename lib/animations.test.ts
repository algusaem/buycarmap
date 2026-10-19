import { describe, expect, it } from "vitest";
import {
  crossFade,
  dropdownReveal,
  easeOut,
  fadeInUp,
  motionDuration,
  sheetSlideUp,
  sheetSpring,
} from "./animations";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-2: every Motion preset
// takes its duration and ease from the shared tokens, nothing runs at 0.3s or
// longer, every preset with an exit leaves the way it entered, and the drag
// spring keeps its own physics untouched.

const animations = await import("./animations");
type Exported = (typeof animations)[keyof typeof animations];
/** An exported preset: anything with a `transition` (the drag spring is a transition itself, not a preset). */
type Preset = Extract<Exported, { transition: object }>;
type ExitingPreset = Extract<Preset, { exit: object }>;

function isPreset(value: Exported): value is Preset {
  return typeof value === "object" && "transition" in value;
}

/** Every preset lib/animations.ts exports, by name. */
const presets = Object.entries(animations).filter((entry): entry is [string, Preset] =>
  isPreset(entry[1]),
);
/** The presets that leave as well as enter. */
const exitingPresets = presets.filter(
  (entry): entry is [string, ExitingPreset] => "exit" in entry[1],
);

const SHARED_EASE = [0.23, 1, 0.32, 1];

describe("MOTION-2: motionDuration and easeOut — the shared tokens", () => {
  it("MOTION-2: motionDuration is { fast: 0.12, base: 0.18, sheet: 0.24 }", () => {
    expect(motionDuration).toEqual({ fast: 0.12, base: 0.18, sheet: 0.24 });
  });

  it("MOTION-2: easeOut is the curve [0.23, 1, 0.32, 1]", () => {
    expect(easeOut).toEqual(SHARED_EASE);
  });
});

describe("MOTION-2: dropdownReveal and crossFade run at the base duration with the shared curve", () => {
  it("MOTION-2: dropdownReveal.transition is { duration: 0.18, ease: [0.23, 1, 0.32, 1] }", () => {
    expect(dropdownReveal.transition).toEqual({ duration: 0.18, ease: SHARED_EASE });
  });

  it("MOTION-2: crossFade.transition is { duration: 0.18, ease: [0.23, 1, 0.32, 1] }", () => {
    expect(crossFade.transition).toEqual({ duration: 0.18, ease: SHARED_EASE });
  });
});

describe("MOTION-2: sheetSlideUp and fadeInUp run at the sheet duration with the shared curve", () => {
  it("MOTION-2: sheetSlideUp.transition is { duration: 0.24, ease: [0.23, 1, 0.32, 1] }", () => {
    expect(sheetSlideUp.transition).toEqual({ duration: 0.24, ease: SHARED_EASE });
  });

  it("MOTION-2: fadeInUp.transition is { duration: 0.24, ease: [0.23, 1, 0.32, 1] }, where it ran at 0.5s", () => {
    expect(fadeInUp.transition).toEqual({ duration: 0.24, ease: SHARED_EASE });
  });
});

describe("MOTION-2: no preset runs at 0.3s or longer", () => {
  it("MOTION-2: the presets are fadeInUp, dropdownReveal, sheetSlideUp and crossFade", () => {
    expect(presets.map(([name]) => name).sort()).toEqual(
      ["crossFade", "dropdownReveal", "fadeInUp", "sheetSlideUp"].sort(),
    );
  });

  it.each(presets)("MOTION-2: %s's transition.duration is under 0.3", (_name, preset) => {
    expect(preset.transition.duration).toBeLessThan(0.3);
  });
});

describe("MOTION-2: every preset with an exit leaves the way it entered", () => {
  it("MOTION-2: dropdownReveal, sheetSlideUp and crossFade have an exit", () => {
    expect(exitingPresets.map(([name]) => name).sort()).toEqual(
      ["crossFade", "dropdownReveal", "sheetSlideUp"].sort(),
    );
  });

  it.each(exitingPresets)("MOTION-2: %s's exit matches its initial", (_name, preset) => {
    expect(preset.exit).toEqual(preset.initial);
  });
});

describe("MOTION-2: sheetSpring keeps its own physics", () => {
  it("MOTION-2: sheetSpring is unchanged — { type: 'spring', stiffness: 500, damping: 40 }", () => {
    expect(sheetSpring).toEqual({ type: "spring", stiffness: 500, damping: 40 });
  });
});
