import { existsSync } from "node:fs";
import path from "node:path";

// The four server-layer templates. Resolved against process.cwd() rather
// than this plopfile's own directory: `pnpm gen` always runs from the repo
// root, and so does scripts/core-layout.node.test.ts's LAYOUT-9 check, which
// copies only this file (plus docs/specs/_template.md) into an isolated
// temp directory to prove the generator refuses to redo an existing
// feature — it does not carry plop-templates/ with it, so a path resolved
// against the copy's own location would not find the templates.
const FEATURE_TEMPLATES_DIR = path.resolve(process.cwd(), "plop-templates", "feature");
const FEATURE_FILES = ["queries.ts", "actions.ts", "service.ts", "schema.ts"];

export default function (plop) {
  plop.setGenerator("feature", {
    description: "Scaffold server/<name>/{queries,actions,service,schema}.ts and its spec",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Feature name (kebab-case, e.g. widgets or two-factor):",
        validate: (value) =>
          /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ||
          "Use kebab-case: lowercase letters, digits and hyphens, e.g. widgets or two-factor.",
      },
    ],
    actions: [
      // Refuses to redo an existing feature, or to overwrite an existing
      // spec, and writes nothing when it does: this runs before any add
      // action below, and node-plop aborts the remaining actions once one
      // fails (docs/specs/core-layout.md LAYOUT-9).
      async (data, _actionConfig, plopApi) => {
        const destBasePath = plopApi.getDestBasePath();
        if (existsSync(path.join(destBasePath, "server", data.name))) {
          throw new Error(`server/${data.name} already exists`);
        }
        if (existsSync(path.join(destBasePath, "docs", "specs", `${data.name}.md`))) {
          throw new Error(`docs/specs/${data.name}.md already exists`);
        }
      },
      ...FEATURE_FILES.map((file) => ({
        type: "add",
        path: `server/{{name}}/${file}`,
        templateFile: path.join(FEATURE_TEMPLATES_DIR, `${file}.hbs`),
      })),
      {
        type: "add",
        path: "docs/specs/{{name}}.md",
        templateFile: "docs/specs/_template.md",
      },
    ],
  });
}
