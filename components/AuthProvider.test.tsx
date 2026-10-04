import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: Better Auth's
// `authClient.useSession()` reads from its own nanostores atom and needs no
// context provider, unlike NextAuth's `SessionProvider` this used to wrap
// `children` in — so there is nothing left to mock or assert on beyond
// children actually rendering.
describe("AuthProvider", () => {
  it("renders its children", () => {
    render(
      <AuthProvider>
        <span>protected child</span>
      </AuthProvider>,
    );

    expect(screen.getByText("protected child")).toBeInTheDocument();
  });
});
