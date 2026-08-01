import { createHash } from "node:crypto";

// Breach check against Have I Been Pwned's Pwned Passwords corpus (~850M
// leaked credentials). This is the part of the password policy that actually
// stops weak passwords — a 14-character passphrase can still be worthless if
// it is already sitting in a credential-stuffing list.
//
// Uses the k-anonymity range API: we send only the FIRST FIVE characters of the
// SHA-1 hash and get back every suffix sharing that prefix (~500-1000 rows),
// then match locally. The full hash never leaves this process, and the password
// itself never leaves it either. No API key required.
//
// SHA-1 here is not a security choice — it is the digest HIBP's index is built
// on. It is used purely to look up a public dataset, never to store anything.

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";
const PREFIX_LENGTH = 5;
const REQUEST_TIMEOUT_MS = 3000;

export interface BreachCheckResult {
  breached: boolean;
  // How many times the password appears across known breaches. 0 when clean,
  // and also 0 when the check could not run (see `checked`).
  occurrences: number;
  // False when HIBP was unreachable. Callers should treat that as "unknown",
  // not "safe" — we fail open so an outage cannot lock users out of signup.
  checked: boolean;
}

const CLEAN: BreachCheckResult = {
  breached: false,
  occurrences: 0,
  checked: false,
};

function sha1Upper(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

// Parses the "SUFFIX:COUNT" lines HIBP returns and finds our suffix.
function findSuffix(body: string, suffix: string): number {
  for (const line of body.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    if (line.slice(0, separator).trim() !== suffix) continue;

    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    return Number.isNaN(count) ? 0 : count;
  }

  return 0;
}

export async function checkPasswordBreached(
  password: string,
): Promise<BreachCheckResult> {
  if (!password) return CLEAN;

  const hash = sha1Upper(password);
  const prefix = hash.slice(0, PREFIX_LENGTH);
  const suffix = hash.slice(PREFIX_LENGTH);

  try {
    const response = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
      headers: {
        // Opts into padded responses: HIBP appends random dummy hashes so the
        // response size cannot be used to infer anything about our query.
        "Add-Padding": "true",
        "User-Agent": "BuyCarMap-password-check",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return CLEAN;

    const occurrences = findSuffix(await response.text(), suffix);

    return { breached: occurrences > 0, occurrences, checked: true };
  } catch {
    // Network failure, timeout, or HIBP outage. Fail open: a registration
    // should not be blocked because a third-party API is down. The length
    // rules and local blocklist still apply.
    return CLEAN;
  }
}
