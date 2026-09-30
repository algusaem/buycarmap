import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// Inside a git hook, git exports GIT_DIR, GIT_INDEX_FILE and friends pointing at
// this repository. The script tests run git in throwaway repos, and inherited
// GIT_* variables would redirect those commands back here, so drop them.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GIT_")) delete process.env[key];
}

// Route handlers and server actions run in the node environment and hit the
// upstream APIs directly; MSW intercepts those. Unhandled requests fail loudly.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
