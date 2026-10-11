import { useContext } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MotionConfigContext } from "motion/react";
import { ThemeProvider } from "./ThemeProvider";

// FRONT-29 (docs/specs/core-frontend.md, issue #9): every page renders
// inside a MotionConfig with reducedMotion="user", so Motion switches off
// transform/opacity animations for a user whose OS asks for reduced motion.
// ThemeProvider is the existing client boundary that already wraps every
// page (app/layout.tsx), so this is where the config is set.
describe("ThemeProvider", () => {
  it('FRONT-29: provides a MotionConfig context with reducedMotion set to "user"', () => {
    let reducedMotion: string | undefined;

    function Probe() {
      reducedMotion = useContext(MotionConfigContext).reducedMotion;
      return null;
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(reducedMotion).toBe("user");
  });
});
