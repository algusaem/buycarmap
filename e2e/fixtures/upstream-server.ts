import http from "node:http";
import {
  cochesNetFixture,
  cochesNetModelsFixture,
  emptyCochesNetFixture,
  emptyMilanunciosFixture,
  emptyWallapopFixture,
  milanunciosFixture,
  milanunciosHtml,
  wallapopFixture,
  wallapopModelsFixture,
} from "./network";

// FRONT-22 (docs/specs/core-frontend.md). Search now runs through a Server
// Action (server/search/service.ts) instead of a browser-bound proxy, so
// `page.route()` can no longer stub it — the request is made by the Next dev
// server itself and never reaches the browser. This plain node:http server
// stands in for Wallapop, coches.net and Milanuncios: playwright.config.ts
// gives it its own `webServer` entry on a fixed port and points
// WALLAPOP_API_BASE_URL/COCHESNET_API_BASE_URL/MILANUNCIOS_BASE_URL (lib/env.ts)
// at it for the whole e2e run, so a Playwright run never reaches a real
// marketplace.
//
// Scenarios switch the payload set every route below answers with, via the
// control endpoint `POST /__scenario { "scenario": "default" | "empty" }`:
// - "default" mirrors the old page.route() stubs' one-listing-per-source
//   payload (e2e/fixtures/network.ts's mockListingSources).
// - "empty" mirrors screenshots.spec.ts's old all-sources-empty override.
// e2e/global-setup.ts resets the scenario to "default" once the server is up,
// so every run starts from "default".
//
// Single process shared by every Playwright worker (same as the `pnpm dev`
// webServer entry), so only screenshots.spec.ts — the one file that ever asks
// for a scenario other than "default" — switches it, and does so serially
// with a reset back to "default" after each test (see its own header
// comment). Every other spec only ever requests "default", so it never races.

type Scenario = "default" | "empty";
let currentScenario: Scenario = "default";

function sourcesFor(scenario: Scenario) {
  if (scenario === "empty") {
    return {
      wallapop: emptyWallapopFixture,
      cochesNet: emptyCochesNetFixture,
      milanuncios: emptyMilanunciosFixture,
    };
  }
  return {
    wallapop: wallapopFixture,
    cochesNet: cochesNetFixture,
    milanuncios: milanunciosFixture,
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendHtml(res: http.ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

async function handleScenarioSwitch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let body: { scenario?: string };
  try {
    body = (await readJsonBody(req)) as { scenario?: string };
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  if (body.scenario !== "default" && body.scenario !== "empty") {
    sendJson(res, 400, { error: `unknown scenario "${String(body.scenario)}"` });
    return;
  }

  currentScenario = body.scenario;
  sendJson(res, 200, { scenario: currentScenario });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "POST" && pathname === "/__scenario") {
    await handleScenarioSwitch(req, res);
    return;
  }

  const sources = sourcesFor(currentScenario);

  // Wallapop: GET /api/v3/search/filters/model (models), GET /api/v3/search/section (search).
  if (req.method === "GET" && pathname === "/api/v3/search/filters/model") {
    sendJson(res, 200, wallapopModelsFixture);
    return;
  }
  if (req.method === "GET" && pathname === "/api/v3/search/section") {
    sendJson(res, 200, sources.wallapop);
    return;
  }

  // coches.net: GET /models (taxonomy), POST /search/listing (search).
  if (req.method === "GET" && pathname === "/models") {
    sendJson(res, 200, cochesNetModelsFixture);
    return;
  }
  if (req.method === "POST" && pathname === "/search/listing") {
    sendJson(res, 200, sources.cochesNet);
    return;
  }

  // Milanuncios has no JSON API: server/search/service.ts GETs a
  // brand-specific slug path (e.g. /seat-de-segunda-mano/) that this server
  // doesn't need to parse — every GET not matched above is the search page.
  if (req.method === "GET") {
    sendHtml(res, 200, milanunciosHtml(sources.milanuncios));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const port = Number(process.env.E2E_UPSTREAM_PORT ?? 3912);
server.listen(port, () => {
  console.log(`[e2e upstream] listening on :${port}`);
});
