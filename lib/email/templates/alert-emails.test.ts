import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeMatchListing } from "@/test/fixtures/alerts";
import { renderAlertEmail } from "./alert-emails";

/** Records any source API touched while the email is built. */
function countSourceCalls() {
  const calls: string[] = [];
  server.use(
    http.get("*/api/wallapop/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
    http.post("*/api/cochesnet/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
    http.get("*/api/milanuncios/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
  );
  return calls;
}

const MATCHES = [
  makeMatchListing({
    id: "wallapop-abc123",
    title: "Audi A3 2.0 TDI",
    price: 14500,
    mileage: 95000,
    year: 2018,
    location: "Madrid",
    url: "https://es.wallapop.com/item/audi-a3-abc123",
  }),
  makeMatchListing({
    id: "cochesnet-99",
    title: "Seat Leon FR",
    price: 11200,
    source: "Coches.net",
    url: "https://www.coches.net/seat-leon-99",
  }),
];

describe("renderAlertEmail", () => {
  it("ALERT-22: renders every match from the stored snapshot alone", async () => {
    const sourceCalls = countSourceCalls();

    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: MATCHES,
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    expect(email.html).toContain("Audi A3 2.0 TDI");
    expect(email.html).toContain("Seat Leon FR");
    // The snapshot is the point: the mail is built by a cron with no browser
    // and no guarantee any source is reachable.
    expect(sourceCalls).toEqual([]);
  });

  it("ALERT-22: links each match to its original listing", async () => {
    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: MATCHES,
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    expect(email.html).toContain("https://es.wallapop.com/item/audi-a3-abc123");
    expect(email.html).toContain("https://www.coches.net/seat-leon-99");
  });

  it("ALERT-22: carries the price and mileage the match was found at", async () => {
    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: [MATCHES[0]],
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    // 14500 formatted for a Spanish-market app: thousands separated with a dot.
    expect(email.html).toMatch(/14[.,]500/);
    expect(email.html).toMatch(/95[.,]000/);
  });

  it("ALERT-22: includes a plain-text alternative carrying the same matches", async () => {
    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: MATCHES,
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    expect(email.text).toContain("Audi A3 2.0 TDI");
    expect(email.text).toContain("Seat Leon FR");
    expect(email.text).not.toContain("<a ");
  });

  it("ALERT-22: always offers the unsubscribe link", async () => {
    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: [MATCHES[0]],
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    expect(email.html).toContain(
      "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    );
    expect(email.text).toContain(
      "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    );
  });

  it("ALERT-22: escapes a title containing markup rather than emitting it", async () => {
    const email = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: [
        makeMatchListing({ title: "Audi <script>alert(1)</script> A3" }),
      ],
      unsubscribeUrl: "https://buycarmap.test/api/alerts/unsubscribe?token=t0k",
    });

    // Titles come from three scraped upstreams, so they are attacker-influenced.
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("ALERT-32: writes the subject in the locale it is given", async () => {
    const english = await renderAlertEmail({
      locale: "en",
      alertLabel: "Audi A3 under 20k",
      matches: [MATCHES[0]],
      unsubscribeUrl: "https://buycarmap.test/u?token=t0k",
    });
    const spanish = await renderAlertEmail({
      locale: "es",
      alertLabel: "Audi A3 under 20k",
      matches: [MATCHES[0]],
      unsubscribeUrl: "https://buycarmap.test/u?token=t0k",
    });

    expect(english.subject).not.toBe(spanish.subject);
    expect(english.subject).toMatch(/new|match/i);
    expect(spanish.subject).toMatch(/nuevo|coche/i);
  });
});
