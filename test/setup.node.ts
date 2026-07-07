import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// Route handlers and server actions run in the node environment and hit the
// upstream APIs directly; MSW intercepts those. Unhandled requests fail loudly.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
