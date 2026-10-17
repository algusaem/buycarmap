import { useContext } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MotionConfigContext } from "motion/react";
import { MotionProvider } from "./MotionProvider";

// FRONT-29 (docs/specs/core-frontend.md, amended 2026-10-12, LOOK —
// redesign-foundation.md, issue #9): every page renders inside a
// MotionConfig with reducedMotion="user", so Motion switches off
// transform/opacity animations for a user whose OS asks for reduced
// motion. The config moved out of the next-themes wrapper (ThemeProvider)
// into its own components/MotionProvider.tsx, because the single dark
// theme needs no theme provider at all.

describe("MotionProvider", () => {
  it('FRONT-29: provides a MotionConfig context with reducedMotion set to "user" (amended 2026-10-12, LOOK — redesign-foundation.md)', () => {
    let reducedMotion: string | undefined;

    function Probe() {
      reducedMotion = useContext(MotionConfigContext).reducedMotion;
      return null;
    }

    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );

    expect(reducedMotion).toBe("user");
  });
});
