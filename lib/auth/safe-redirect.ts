// docs/specs/redesign-entry.md (ENTRY-17). After signing in, the user goes to
// `callbackUrl` only when it resolves to this site's own origin — checked by
// actually resolving it with `new URL(value, origin)` rather than pattern-
// matching the string, which is how a backslash path ("/\evil.example", sent
// as "/%5Cevil.example") used to slip through: a browser normalises the
// backslash to a slash before its own "//" protocol-relative check, so it
// resolved to evil.example's origin. Anything that fails any of these,
// `null` included, falls back to "/".
export function safeRedirectTarget(value: string | null, origin: string): string {
  if (value === null) return "/";
  // Exactly one leading slash (not "//", not "/\"), and no backslash anywhere
  // — "/\evil.example" fails here before it ever reaches `new URL`.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  // Reject a raw value with control characters, or an encoded slash/backslash
  // right after the leading slash — both are ways to smuggle a path that
  // resolves to a protocol-relative pathname past the checks below.
  const hasControlCharacter = Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (hasControlCharacter) return "/";
  if (/^\/(%2f|%5c)/i.test(value)) return "/";
  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return "/";
    // A dot-segment path like "/.//evil.example" normalises to a pathname
    // starting with "//", which a browser reads as protocol-relative to
    // evil.example even though `origin` above matched.
    if (resolved.pathname.startsWith("//")) return "/";
    // The same encoded-slash/backslash check as above, now against the
    // *resolved* pathname: the URL parser treats a literal ".." segment and
    // its percent-encoded look-alikes (".%2e", "%2e.", "%2e%2e") the same
    // way when removing dot segments, so "/a/%2e%2e/%2fevil.example"
    // normalises to "/%2fevil.example" — a path that never matched the raw
    // check above, because the raw string didn't start with "/%2f".
    if (/^\/(%2f|%5c)/i.test(resolved.pathname)) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}
