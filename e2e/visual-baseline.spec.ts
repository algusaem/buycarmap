import { test, expect } from "@playwright/test";
import { visualBaselineSkipReason } from "./fixtures/visual-baseline";

// TEST-15 (docs/specs/core-testing.md): the rule e2e/visual.spec.ts uses to
// decide whether a visual test skips. It needs no page or server, so it runs
// in the `chromium` project — and therefore in CI, where the visual project
// itself always skips for want of Linux baselines.

const LOGIN_ON_LINUX = { name: "login", platform: "linux" };

const MISSING_LINUX_LOGIN =
  'No linux baseline for "login". Generate one on this platform with: pnpm test:visual --update-snapshots';

test.describe("visualBaselineSkipReason", () => {
  test("TEST-15: a plain run without a baseline skips, naming the command that generates it", () => {
    expect(
      visualBaselineSkipReason({
        ...LOGIN_ON_LINUX,
        updateSnapshots: "missing",
        baselineExists: false,
      }),
    ).toBe(MISSING_LINUX_LOGIN);
  });

  test("TEST-15: --update-snapshots without a baseline runs, so the baseline is written", () => {
    expect(
      visualBaselineSkipReason({
        ...LOGIN_ON_LINUX,
        updateSnapshots: "changed",
        baselineExists: false,
      }),
    ).toBeNull();
  });

  test("TEST-15: --update-snapshots=all without a baseline runs", () => {
    expect(
      visualBaselineSkipReason({
        ...LOGIN_ON_LINUX,
        updateSnapshots: "all",
        baselineExists: false,
      }),
    ).toBeNull();
  });

  test("TEST-15: --update-snapshots=none without a baseline skips", () => {
    expect(
      visualBaselineSkipReason({
        ...LOGIN_ON_LINUX,
        updateSnapshots: "none",
        baselineExists: false,
      }),
    ).toBe(MISSING_LINUX_LOGIN);
  });

  test("TEST-15: the reason names the test and the platform it runs on", () => {
    expect(
      visualBaselineSkipReason({
        name: "map",
        platform: "darwin",
        updateSnapshots: "missing",
        baselineExists: false,
      }),
    ).toBe(
      'No darwin baseline for "map". Generate one on this platform with: pnpm test:visual --update-snapshots',
    );
  });

  test("TEST-15: --update-snapshots with a baseline runs, so a differing one is rewritten", () => {
    expect(
      visualBaselineSkipReason({
        name: "login",
        platform: "win32",
        updateSnapshots: "changed",
        baselineExists: true,
      }),
    ).toBeNull();
  });

  test("TEST-15: a plain run with a baseline compares against it", () => {
    expect(
      visualBaselineSkipReason({
        ...LOGIN_ON_LINUX,
        updateSnapshots: "missing",
        baselineExists: true,
      }),
    ).toBeNull();
  });
});
