import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub SessionProvider so this test doesn't try to fetch a real session; assert
// AuthProvider forwards children through it.
const SessionProvider = vi.fn(
  ({ children }: { children: React.ReactNode }) => children,
);
vi.mock("next-auth/react", () => ({
  SessionProvider: (props: { children: React.ReactNode }) =>
    SessionProvider(props),
}));

import { AuthProvider } from "./AuthProvider";

describe("AuthProvider", () => {
  it("wraps its children in a SessionProvider", () => {
    render(
      <AuthProvider>
        <span>protected child</span>
      </AuthProvider>,
    );

    expect(screen.getByText("protected child")).toBeInTheDocument();
    expect(SessionProvider).toHaveBeenCalledOnce();
  });
});
