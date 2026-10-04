import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";

// The unsubscribe link lands in an inbox and must work with no session, so the
// token in it is a bearer credential. A raw alert id would let anyone holding
// one link guess others and deactivate strangers' alerts.
//
// The token is DERIVED rather than stored, which is what makes the hashed
// column workable: the runner sends the mail long after the alert was created
// and only ever sees the hash, so a randomly-generated token would have to be
// kept in the clear for the runner to rebuild the link. An HMAC keyed on
// BETTER_AUTH_SECRET lets the runner recompute it on demand while the database
// still holds nothing usable — a leak yields digests, and forging a token needs
// the signing secret.
//
// Unlike a password-reset token it deliberately never expires. An unsubscribe
// link in a year-old email must still work, because the alternative is a user
// who cannot make the mail stop.

export function unsubscribeTokenFor(alertId: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`alert-unsubscribe:${alertId}`)
    .digest("hex");
}

export function hashUnsubscribeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
