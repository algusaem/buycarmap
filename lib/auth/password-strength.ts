// Password strength estimation, shared by the client meter and the server.
//
// This is deliberately hand-rolled rather than zxcvbn: zxcvbn ships a ~400 kB
// dictionary that would land in the register/reset bundles, and the meter is
// only *guidance*. The authoritative rejection happens server-side against the
// Have I Been Pwned breach corpus (lib/auth/pwned.ts), which catches real-world
// weak passwords far better than any local heuristic can.
//
// Following NIST SP 800-63B: length and blocklists do the work, not composition
// rules. Nothing here rejects a password for lacking a symbol.

export const MIN_PASSWORD_LENGTH = 12;
// bcrypt silently ignores bytes past 72, so a longer password would be
// truncated without the user ever knowing. Reject instead.
export const MAX_PASSWORD_LENGTH = 72;

// Score bands, mapped to i18n keys by the UI.
export type PasswordScore = 0 | 1 | 2 | 3 | 4;

// Issue codes rather than sentences, so the UI can localize them.
export type PasswordIssue =
  | "tooShort"
  | "tooLong"
  | "common"
  | "sequential"
  | "repeated"
  | "personal";

export interface PasswordStrength {
  score: PasswordScore;
  issues: PasswordIssue[];
}

// The passwords that dominate every credential-stuffing list. This is a
// short-circuit for instant feedback while typing; HIBP is the real filter.
const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "abc123",
  "letmein",
  "monkey",
  "dragon",
  "111111",
  "iloveyou",
  "admin",
  "welcome",
  "login",
  "master",
  "hello",
  "freedom",
  "whatever",
  "trustno",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "superman",
  "batman",
  "shadow",
  "michael",
  "jennifer",
  "jordan",
  "harley",
  "ranger",
  "hunter",
  "buster",
  "soccer",
  "tigger",
  "charlie",
  "andrew",
  "matthew",
  "access",
  "thomas",
  "robert",
  "daniel",
  "starwars",
  "computer",
  "internet",
  "samsung",
  "google",
  "facebook",
  "secret",
  "summer",
  "winter",
  "spring",
  "autumn",
  "changeme",
  "passw0rd",
  "qwertyuiop",
  "asdfgh",
  "zxcvbn",
  "pokemon",
  "contrasena",
  "contraseña",
  "hola",
  "amor",
  "españa",
  "espana",
  "madrid",
  "barcelona",
  "real",
  "sevilla",
  "valencia",
  "carlos",
  "javier",
  "manuel",
  "antonio",
  "francisco",
  "maria",
  "carmen",
  "laura",
  "alejandro",
  "coche",
]);

const KEYBOARD_ROWS = [
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "1234567890",
  "qwertzuiop",
  "azertyuiop",
];

// Character-class pool sizes, used for the entropy estimate.
const POOLS = [
  { pattern: /[a-z]/, size: 26 },
  { pattern: /[A-Z]/, size: 26 },
  { pattern: /[0-9]/, size: 10 },
  { pattern: /[^a-zA-Z0-9]/, size: 33 },
];

// Character substitutions people use to dodge composition rules.
function leetify(value: string): string {
  return value
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");
}

// The forms a blocklisted password might be hiding in. Several are needed
// because the transformations interfere with each other: substituting leetspeak
// across the whole string mangles a trailing "123" into letters, so the
// decoration has to come off first — while a purely numeric password
// ("1234567890") only survives if the raw form is checked too.
function candidateForms(password: string): string[] {
  const lower = password.toLowerCase();
  const trimmed = lower.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9]+$/, "");
  const withoutTrailingDigits = trimmed.replace(/\d+$/, "");

  return [
    lower,
    trimmed,
    withoutTrailingDigits,
    leetify(withoutTrailingDigits).replace(/[^a-z]/g, ""),
    leetify(lower).replace(/[^a-z]/g, ""),
  ];
}

function isCommon(password: string): boolean {
  return candidateForms(password).some((form) => form.length > 0 && COMMON_PASSWORDS.has(form));
}

// Runs of 4+ characters that step by one in either direction ("abcd", "4321").
function hasSequentialRun(password: string): boolean {
  const lower = password.toLowerCase();
  let run = 1;
  let direction = 0;

  for (let i = 1; i < lower.length; i++) {
    const step = lower.charCodeAt(i) - lower.charCodeAt(i - 1);

    if (step === direction && (step === 1 || step === -1)) {
      run += 1;
      if (run >= 4) return true;
      continue;
    }

    direction = step === 1 || step === -1 ? step : 0;
    run = direction === 0 ? 1 : 2;
    if (run >= 4) return true;
  }

  return false;
}

// Runs of 4+ adjacent keys on a physical row ("asdf", "poiu").
function hasKeyboardRun(password: string): boolean {
  const lower = password.toLowerCase();

  return KEYBOARD_ROWS.some((row) => {
    const reversed = [...row].reverse().join("");
    for (let i = 0; i + 4 <= row.length; i++) {
      if (lower.includes(row.slice(i, i + 4))) return true;
      if (lower.includes(reversed.slice(i, i + 4))) return true;
    }
    return false;
  });
}

// The same character three or more times in a row ("aaa", "!!!").
function hasRepeatedRun(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

// Does the password contain the user's own email or name? Those are the first
// guesses a targeted attacker makes.
function containsPersonalInfo(password: string, userInputs: readonly string[]): boolean {
  const lower = password.toLowerCase();

  return userInputs.some((raw) => {
    // Only the local part of an email is worth checking; every user at the
    // same domain would otherwise trip on the domain alone.
    const value = raw.toLowerCase().split("@")[0].trim();
    return value.length >= 3 && lower.includes(value);
  });
}

// Shannon-style estimate: characters times the bits contributed by the pool the
// password draws from. Deliberately generous — the penalties below do the work.
function estimateEntropyBits(password: string): number {
  const poolSize = POOLS.reduce(
    (total, pool) => (pool.pattern.test(password) ? total + pool.size : total),
    0,
  );

  if (poolSize === 0) return 0;

  // Repeated characters add far less than a fresh one; count unique characters
  // plus a fraction of the duplicates rather than raw length.
  const unique = new Set(password).size;
  const effectiveLength = unique + (password.length - unique) * 0.4;

  return effectiveLength * Math.log2(poolSize);
}

export function evaluatePassword(
  password: string,
  userInputs: readonly string[] = [],
): PasswordStrength {
  const issues: PasswordIssue[] = [];

  if (password.length === 0) {
    return { score: 0, issues: ["tooShort"] };
  }

  if (password.length < MIN_PASSWORD_LENGTH) issues.push("tooShort");
  if (password.length > MAX_PASSWORD_LENGTH) issues.push("tooLong");
  if (isCommon(password)) issues.push("common");
  if (hasSequentialRun(password) || hasKeyboardRun(password)) {
    issues.push("sequential");
  }
  if (hasRepeatedRun(password)) issues.push("repeated");
  if (containsPersonalInfo(password, userInputs)) issues.push("personal");

  // A blocklisted or self-referential password is worthless regardless of how
  // long it is, so it collapses to the bottom band outright.
  if (issues.includes("common") || issues.includes("personal")) {
    return { score: 0, issues };
  }

  let bits = estimateEntropyBits(password);

  // Predictable structure means an attacker's search space is nowhere near the
  // full pool, so discount heavily rather than subtracting a token amount.
  if (issues.includes("sequential")) bits *= 0.55;
  if (issues.includes("repeated")) bits *= 0.7;

  const score = ((): PasswordScore => {
    if (password.length < MIN_PASSWORD_LENGTH) return bits < 40 ? 0 : 1;
    if (bits < 45) return 1;
    if (bits < 60) return 2;
    if (bits < 80) return 3;
    return 4;
  })();

  return { score, issues };
}
