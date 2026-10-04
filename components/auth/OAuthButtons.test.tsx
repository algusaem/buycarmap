import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { OAuthButtons } from "./OAuthButtons";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: which providers
// are configured is now a prop (lib/app-config.ts, computed server-side in
// app/login/page.tsx and app/register/page.tsx), not a client fetch through
// NextAuth's `getProviders()` — so the component renders synchronously and
// this file drives it with `providers` directly instead of mocking a fetch.
const signInSocial = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));

// GoogleSignInButton reads the resolved theme to pick Google's palette; the
// palette itself is covered in GoogleSignInButton.test.tsx.
const useTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => useTheme() }));

beforeEach(() => {
  signInSocial.mockReset();
  useTheme.mockReturnValue({ resolvedTheme: "dark" });
});

describe("OAuthButtons visibility", () => {
  it("renders nothing at all when no provider is configured", () => {
    const { container } = renderWithI18n(<OAuthButtons providers={[]} />);

    // Including the divider — a lone "or" above empty space looks broken.
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the providers it is given", () => {
    renderWithI18n(<OAuthButtons providers={["google"]} />);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
  });
});

describe("OAuthButtons interaction", () => {
  it("starts the provider round-trip with the requested callback", async () => {
    renderWithI18n(<OAuthButtons providers={["google"]} callbackUrl="/account" />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/login?callbackUrl=%2Faccount",
    });
  });

  it("sends GitHub to its own provider id, not Google's", async () => {
    renderWithI18n(<OAuthButtons providers={["github"]} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/",
      errorCallbackURL: "/login",
    });
  });

  it("sends a rejected OAuth sign-in back to /login, not wherever it started", async () => {
    // Security review fix: without an explicit errorCallbackURL, Better Auth
    // defaults it to the current page, which is never /login for a provider
    // button rendered somewhere else (e.g. /register).
    renderWithI18n(<OAuthButtons providers={["google"]} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ errorCallbackURL: "/login" }),
    );
  });

  it("locks every provider while one redirect is in flight", async () => {
    // Never resolves, mimicking the full-page redirect.
    signInSocial.mockReturnValue(
      new Promise(() => {
        /* deliberately never settles */
      }),
    );
    renderWithI18n(<OAuthButtons providers={["google", "github"]} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue with github/i })).toBeDisabled(),
    );
  });

  it("unlocks the providers when the redirect never happens", async () => {
    // signIn.social resolving means the browser stayed on the page — a
    // misconfigured provider, say. Leaving the buttons dead would strand the
    // visitor.
    signInSocial.mockResolvedValue(undefined);
    renderWithI18n(<OAuthButtons providers={["google", "github"]} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue with github/i })).toBeEnabled(),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<OAuthButtons providers={["google", "github"]} />);
    screen.getByRole("button", { name: /continue with google/i });

    expect(await axe(container)).toHaveNoViolations();
  });
});
