import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { OAuthButtons } from "./OAuthButtons";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const signIn = vi.fn();
const getProviders = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  getProviders: () => getProviders(),
}));

// GoogleSignInButton reads the resolved theme to pick Google's palette; the
// palette itself is covered in GoogleSignInButton.test.tsx.
const useTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => useTheme() }));

function provider(id: string) {
  return { id, name: id, type: "oauth" };
}

beforeEach(() => {
  signIn.mockReset();
  getProviders.mockReset();
  useTheme.mockReturnValue({ resolvedTheme: "dark" });
});

describe("OAuthButtons visibility", () => {
  it("renders nothing at all when no provider is configured", async () => {
    getProviders.mockResolvedValue({});
    const { container } = renderWithI18n(<OAuthButtons />);

    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    // Including the divider — a lone "or" above empty space looks broken.
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the providers the server actually reports", async () => {
    getProviders.mockResolvedValue({ google: provider("google") });
    renderWithI18n(<OAuthButtons />);

    expect(await screen.findByRole("button", { name: /continue with google/i }))
      .toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with github/i }),
    ).not.toBeInTheDocument();
  });

  it("ignores the credentials provider, which is not an OAuth button", async () => {
    getProviders.mockResolvedValue({
      credentials: { id: "credentials", name: "credentials", type: "credentials" },
    });
    const { container } = renderWithI18n(<OAuthButtons />);

    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OAuthButtons interaction", () => {
  beforeEach(() => {
    getProviders.mockResolvedValue({
      google: provider("google"),
      github: provider("github"),
    });
  });

  it("starts the provider round-trip with the requested callback", async () => {
    renderWithI18n(<OAuthButtons callbackUrl="/account" />);

    await userEvent.click(await screen.findByRole("button", {
      name: /continue with google/i,
    }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/account" });
  });

  it("sends GitHub to its own provider id, not Google's", async () => {
    renderWithI18n(<OAuthButtons />);

    await userEvent.click(await screen.findByRole("button", {
      name: /continue with github/i,
    }));

    expect(signIn).toHaveBeenCalledWith("github", { callbackUrl: "/" });
  });

  it("locks every provider while one redirect is in flight", async () => {
    // Never resolves, mimicking the full-page redirect.
    signIn.mockReturnValue(new Promise(() => {}));
    renderWithI18n(<OAuthButtons />);

    await userEvent.click(await screen.findByRole("button", {
      name: /continue with google/i,
    }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeDisabled(),
    );
  });

  it("unlocks the providers when the redirect never happens", async () => {
    // signIn resolving means the browser stayed on the page — a misconfigured
    // provider, say. Leaving the buttons dead would strand the visitor.
    signIn.mockResolvedValue(undefined);
    renderWithI18n(<OAuthButtons />);

    await userEvent.click(await screen.findByRole("button", {
      name: /continue with google/i,
    }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeEnabled(),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<OAuthButtons />);
    await screen.findByRole("button", { name: /continue with google/i });

    expect(await axe(container)).toHaveNoViolations();
  });
});
