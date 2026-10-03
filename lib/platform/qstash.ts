// Verifies that a request to /api/alerts/run was actually sent by QStash
// (docs/decisions/0007-adopt-core-rules.md row 23; docs/specs/core-integrations.md,
// INT-7), with `@upstash/qstash`'s `Receiver` against the `Upstash-Signature`
// header, the raw body, and `QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY`.

import { Receiver } from "@upstash/qstash";
import { env } from "@/lib/env";

/**
 * Verifies the request came from QStash. Never throws: a missing header, a
 * missing signing key, or a `Receiver` error are all "not QStash", so the
 * caller answers `401` rather than letting a verification error surface as a
 * `500`.
 */
export async function verifyQstashSignature(request: Request): Promise<boolean> {
  const signature = request.headers.get("Upstash-Signature");
  if (!signature) return false;

  if (!env.QSTASH_CURRENT_SIGNING_KEY && !env.QSTASH_NEXT_SIGNING_KEY) return false;

  try {
    const body = await request.text();
    const receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY ?? "",
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY ?? "",
    });

    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
