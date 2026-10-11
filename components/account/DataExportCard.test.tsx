import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { DataExportCard } from "./DataExportCard";

// EXPORT-14..17 (docs/specs/account-data-export.md).
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const exportMyData = vi.fn();
vi.mock("@/server/account/actions", () => ({
  exportMyData: (...args: unknown[]) => exportMyData(...args),
}));

const EXPORT_JSON =
  '{"exportedAt":"2026-10-11T09:30:00.000Z","profile":{"email":"ada@example.test"}}';
const LATE_EXPORT_JSON =
  '{"exportedAt":"2026-10-11T23:30:00.000Z","profile":{"email":"ada@example.test"}}';

const button = () => screen.getByRole("button", { name: "Download my data" });

interface Download {
  name: string;
  href: string;
}

// jsdom implements neither object URLs nor downloads: the blob handed to
// createObjectURL and the anchor that is clicked are what a browser would save.
let downloads: Download[];
let blobs: Blob[];

beforeEach(() => {
  exportMyData.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  downloads = [];
  blobs = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:export-${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataExportCard", () => {
  it("EXPORT-14: downloads the returned string as a dated JSON file, with no success toast", async () => {
    exportMyData.mockResolvedValue({ success: true, data: EXPORT_JSON });
    renderWithI18n(<DataExportCard />);

    expect(screen.getAllByRole("button")).toHaveLength(1);

    await userEvent.click(button());

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(exportMyData).toHaveBeenCalledTimes(1);
    expect(downloads[0]).toEqual({ name: "buycarmap-data-2026-10-11.json", href: "blob:export-1" });
    expect(blobs[0].type).toBe("application/json");
    expect(await blobs[0].text()).toBe(EXPORT_JSON);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("EXPORT-14: names the file after the UTC date of exportedAt, even past local midnight", async () => {
    exportMyData.mockResolvedValue({ success: true, data: LATE_EXPORT_JSON });
    renderWithI18n(<DataExportCard />);

    await userEvent.click(button());

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe("buycarmap-data-2026-10-11.json");
  });

  it("EXPORT-15: while running, the button is disabled and busy with a spinner, keeps its label, and ignores a second activation", async () => {
    let resolveExport: ((value: { success: boolean; data: string }) => void) | undefined;
    exportMyData.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );
    renderWithI18n(<DataExportCard />);

    await userEvent.click(button());

    await waitFor(() => expect(button()).toBeDisabled());
    expect(button()).toHaveAttribute("aria-busy", "true");
    expect(button()).toHaveTextContent("Download my data");
    expect(button().querySelector("svg")).not.toBeNull();

    // A disabled button blocks pointer events; skip that check so the second
    // click really reaches the button.
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button());
    expect(exportMyData).toHaveBeenCalledTimes(1);

    resolveExport?.({ success: true, data: EXPORT_JSON });

    await waitFor(() => expect(button()).toBeEnabled());
    expect(button()).not.toHaveAttribute("aria-busy", "true");
    expect(downloads).toHaveLength(1);
    expect(exportMyData).toHaveBeenCalledTimes(1);
  });

  it("EXPORT-16: a failure shows the translated error toast, downloads nothing, and re-enables the button", async () => {
    exportMyData.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<DataExportCard />);

    await userEvent.click(button());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Too many attempts. Please wait a few minutes and try again.",
      ),
    );
    expect(downloads).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("EXPORT-17: the button is named, works with Enter and with Space, and the section has no axe violations", async () => {
    exportMyData.mockResolvedValue({ success: true, data: EXPORT_JSON });
    const { container } = renderWithI18n(<DataExportCard />);

    expect(await axe(container)).toHaveNoViolations();

    button().focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(downloads).toHaveLength(1));
    await waitFor(() => expect(button()).toBeEnabled());

    button().focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(exportMyData).toHaveBeenCalledTimes(2);
  });
});
