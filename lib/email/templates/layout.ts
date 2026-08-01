// Shared chrome for transactional emails.
//
// Plain string templates with inline styles, not React/JSX: mail clients strip
// <style> blocks and ignore CSS variables, so the app's design tokens are
// hardcoded to their hex equivalents here (amber #E8A849 on a light card).
// Emails render light regardless of the app's dark-first theme, because most
// clients do not honour prefers-color-scheme reliably.

const PRIMARY = "#E8A849";
const INK = "#1C2128";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

/**
 * Escapes values interpolated into email HTML.
 *
 * `name` is user-controlled and arrives from registration, so it must never be
 * concatenated into markup raw — otherwise a display name could inject markup
 * into an email we send on the user's behalf.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailLayoutInput {
  heading: string;
  bodyHtml: string;
  footer: string;
}

export function renderLayout({
  heading,
  bodyHtml,
  footer,
}: EmailLayoutInput): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#F5F5F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:14px;font-weight:700;letter-spacing:0.02em;color:${PRIMARY};">BuyCarMap</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(heading)}</h1>
          ${bodyHtml}
        </td>
      </tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;text-align:center;font-size:12px;color:${MUTED};">${escapeHtml(footer)}</p>
  </body>
</html>`;
}

export function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(text)}</p>`;
}

export function renderMutedParagraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(text)}</p>`;
}

export function renderButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      <td style="border-radius:8px;background-color:${PRIMARY};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:${INK};text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

// Long URLs must wrap or they blow out the card width on mobile clients.
export function renderRawLink(url: string): string {
  return `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:${MUTED};">${escapeHtml(url)}</a></p>`;
}
