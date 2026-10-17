import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/specs/redesign-map.md (MAPUI-48). Dependency-free, like every other
// scripts/*.node.test.ts (docs/ARCHITECTURE.md › Directory map).

const ROOT = join(__dirname, "..");

// The working tree, not the git index: a new file that still imports the
// select fails this before it is ever staged.
const SOURCE_DIRS = ["app", "components", "lib", "server"];

function sourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((path) => /\.tsx?$/.test(path))
      .map((path) => join(dir, path)),
  );
}

describe("MAPUI-48: the Radix select is fully removed", () => {
  it("MAPUI-48: components/ui/select.tsx no longer exists", () => {
    expect(existsSync(join(ROOT, "components/ui/select.tsx"))).toBe(false);
  });

  it("MAPUI-48: package.json no longer lists @radix-ui/react-select", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.["@radix-ui/react-select"]).toBeUndefined();
    expect(pkg.devDependencies?.["@radix-ui/react-select"]).toBeUndefined();
  });

  it("MAPUI-48: no source file imports components/ui/select.tsx or @radix-ui/react-select", () => {
    const offenders: string[] = [];
    for (const path of sourceFiles()) {
      const content = readFileSync(join(ROOT, path), "utf-8");
      if (content.includes("components/ui/select") || content.includes("@radix-ui/react-select")) {
        offenders.push(path);
      }
    }

    expect(offenders).toEqual([]);
  });
});
