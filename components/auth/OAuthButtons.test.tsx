import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { OAuthButtons } from "./OAuthButtons";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: whether Google is
// configured is now a prop (lib/app-config.ts, computed server-side in
// app/login/page.tsx and app/register/page.tsx), not a client fetch through
// NextAuth's `getProviders()` — so the component renders synchronously and
// this file drives it with `googleEnabled` directly instead of mocking a fetch.
const signInSocial = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));

beforeEach(() => {
  signInSocial.mockReset();
});

describe("OAuthButtons visibility", () => {
  it("renders nothing at all when no provider is configured", () => {
    const { container } = renderWithI18n(<OAuthButtons googleEnabled={false} />);

    // Including the divider — a lone "or" above empty space looks broken.
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the providers it is given", () => {
    renderWithI18n(<OAuthButtons googleEnabled={true} />);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
  });
});

describe("OAuthButtons interaction", () => {
  it("starts the provider round-trip with the requested callback", async () => {
    renderWithI18n(<OAuthButtons googleEnabled={true} callbackUrl="/account" />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/login?callbackUrl=%2Faccount",
    });
  });

  it("sends a rejected OAuth sign-in back to /login, not wherever it started", async () => {
    // Security review fix: without an explicit errorCallbackURL, Better Auth
    // defaults it to the current page, which is never /login for a provider
    // button rendered somewhere else (e.g. /register).
    renderWithI18n(<OAuthButtons googleEnabled={true} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ errorCallbackURL: "/login" }),
    );
  });

  it("locks the provider button while its redirect is in flight", async () => {
    // Never resolves, mimicking the full-page redirect. Google is the only
    // provider the product offers (ENTRY-16, ENTRY-18), so there is no other
    // provider's button left to lock alongside it.
    signInSocial.mockReturnValue(
      new Promise(() => {
        /* deliberately never settles */
      }),
    );
    renderWithI18n(<OAuthButtons googleEnabled={true} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeDisabled(),
    );
  });

  it("unlocks the provider button when the redirect never happens", async () => {
    // signIn.social resolving means the browser stayed on the page — a
    // misconfigured provider, say. Leaving the button dead would strand the
    // visitor.
    signInSocial.mockResolvedValue(undefined);
    renderWithI18n(<OAuthButtons googleEnabled={true} />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled(),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<OAuthButtons googleEnabled={true} />);
    screen.getByRole("button", { name: /continue with google/i });

    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-entry.md (ENTRY-16). The "Google not configured" half
// is already covered by "renders nothing at all when no provider is
// configured" above (the login/register pages never pass true for
// `googleEnabled` when isGoogleConfigured is false) — restated here under
// its own criterion id for pnpm spec:check. The "GitHub never shown" half:
// `OAuthButtonsProps` has no provider list left to put "github" in at all
// (ENTRY-18) — `googleEnabled` is a boolean, so there is no prop shape left
// that could render a GitHub button either way.
describe("ENTRY-16: OAuthButtons — no Google configured, no GitHub ever", () => {
  it("ENTRY-16: with Google not configured, renders neither the divider nor a Google button", () => {
    const { container } = renderWithI18n(<OAuthButtons googleEnabled={false} />, { locale: "es" });

    expect(container).toBeEmptyDOMElement();
  });

  it("ENTRY-16: with Google configured, renders no GitHub button — there is no prop left to ask for one", () => {
    renderWithI18n(<OAuthButtons googleEnabled={true} />, { locale: "es" });

    expect(screen.queryByRole("button", { name: /github/i })).not.toBeInTheDocument();
  });
});
