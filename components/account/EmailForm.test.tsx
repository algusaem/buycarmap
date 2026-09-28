import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { EmailForm } from "./EmailForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const requestEmailChange = vi.fn();
const requestEmailVerification = vi.fn();
vi.mock("@/app/actions/email-verification", () => ({
  requestEmailChange: (...args: unknown[]) => requestEmailChange(...args),
  requestEmailVerification: (...args: unknown[]) => requestEmailVerification(...args),
}));

const CURRENT = "ada@example.com";

async function fillChange(newEmail = "new@example.com") {
  await userEvent.type(screen.getByLabelText("New email address"), newEmail);
  await userEvent.type(screen.getByLabelText("Current password"), "the-current-password");
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Change email" }));

beforeEach(() => {
  requestEmailChange.mockReset();
  requestEmailVerification.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("EmailForm verification state", () => {
  it("shows a verified badge and hides the verify button", () => {
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send verification email" }),
    ).not.toBeInTheDocument();
  });

  it("offers verification when the address is unverified", async () => {
    requestEmailVerification.mockResolvedValue({ success: true });
    renderWithI18n(<EmailForm email={CURRENT} isVerified={false} canChange />);

    expect(screen.getByText("Not verified")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send verification email" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Verification email sent. Check your inbox."),
    );
  });

  it("states verification status in text, not by colour alone", () => {
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    // Colour-blind and screen-reader users need the word, not just a hue.
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});

describe("EmailForm change flow", () => {
  it("hides the change form for OAuth-only accounts", () => {
    // No password to prove identity with, and the provider owns the address.
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange={false} />);

    expect(screen.queryByLabelText("New email address")).not.toBeInTheDocument();
  });

  it("requires the current password alongside the new address", async () => {
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    await userEvent.type(screen.getByLabelText("New email address"), "new@example.com");
    await submit();

    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(requestEmailChange).not.toHaveBeenCalled();
  });

  it("submits both fields", async () => {
    requestEmailChange.mockResolvedValue({ success: true });
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    await fillChange();
    await submit();

    await waitFor(() => expect(requestEmailChange).toHaveBeenCalledOnce());
    const submitted = requestEmailChange.mock.calls[0][0] as FormData;
    expect(submitted.get("email")).toBe("new@example.com");
    expect(submitted.get("currentPassword")).toBe("the-current-password");
  });

  it("shows a neutral confirmation that reveals nothing about the target", async () => {
    requestEmailChange.mockResolvedValue({ success: true });
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    await fillChange();
    await submit();

    // Same wording whether the address was free or already taken.
    expect(await screen.findByText(/If that address is available/i)).toBeInTheDocument();
  });

  it("puts a wrong-password rejection on the password field", async () => {
    requestEmailChange.mockResolvedValue({
      success: false,
      error: "currentPasswordIncorrect",
    });
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    await fillChange();
    await submit();

    expect(await screen.findByText("Your current password is incorrect")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("puts a same-address rejection on the email field", async () => {
    requestEmailChange.mockResolvedValue({
      success: false,
      error: "sameEmail",
    });
    renderWithI18n(<EmailForm email={CURRENT} isVerified canChange />);

    await fillChange(CURRENT);
    await submit();

    expect(await screen.findByText("That is already your email address")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <EmailForm email={CURRENT} isVerified={false} canChange />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
