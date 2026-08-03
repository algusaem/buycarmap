import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { MobileMapOverlay } from "./MobileMapOverlay";

// I18nProvider reads useRouter to refresh after a locale change.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const closeButton = () => screen.getByRole("button", { name: "Close map" });

describe("MobileMapOverlay", () => {
  it("renders its children alongside a labelled close control", () => {
    renderWithI18n(
      <MobileMapOverlay onClose={vi.fn()}>
        <p>map contents</p>
      </MobileMapOverlay>,
    );

    expect(screen.getByText("map contents")).toBeInTheDocument();
    expect(closeButton()).toBeInTheDocument();
  });

  it("closes on click", async () => {
    const onClose = vi.fn();
    renderWithI18n(
      <MobileMapOverlay onClose={onClose}>
        <p>map contents</p>
      </MobileMapOverlay>,
    );

    await userEvent.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on keyboard activation — the control is a real button", async () => {
    const onClose = vi.fn();
    renderWithI18n(
      <MobileMapOverlay onClose={onClose}>
        <p>map contents</p>
      </MobileMapOverlay>,
    );

    closeButton().focus();
    await userEvent.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <MobileMapOverlay onClose={vi.fn()}>
        <p>map contents</p>
      </MobileMapOverlay>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
