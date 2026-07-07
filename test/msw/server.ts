import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// One shared MSW server for every test environment. Individual tests override
// specific endpoints with `server.use(...)` and the lifecycle hooks in the
// setup files reset those overrides between tests.
export const server = setupServer(...handlers);
