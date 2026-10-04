import { Body, Button, Container, Head, Heading, Html, Link, Text } from "@react-email/components";
import { createTranslator } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const MESSAGES = { en: enMessages, es: esMessages } satisfies Record<Locale, unknown>;

/** Every call site only ever does `t("someKey")` — ICU args and `t.rich`/`t.markup` are unused here. */
type SimpleTranslator = (key: string) => string;

/**
 * FRONT-9/FRONT-10 (docs/specs/core-frontend.md): no request is in flight
 * when an email is built — some are sent by the alert cron, all of them
 * outside React's client context — so this is `createTranslator`,
 * next-intl's standalone entry point, rather than `getTranslations()` or
 * `useTranslations()`, with the recipient's own saved or chosen locale and
 * the same JSON messages every other surface uses.
 *
 * `namespace` is a computed string, not a literal, so it can never satisfy
 * `createTranslator`'s precise `NamespaceKeys<...>` generic the way each call
 * site's own literal namespace could inline — the `as never` below is the
 * same "this value is checked at the real call sites, not here" escape the
 * two casts around it make explicit via `SimpleTranslator` instead.
 */
export function emailTranslator(locale: Locale, namespace: string): SimpleTranslator {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: namespace as never,
  }) as SimpleTranslator;
}

// Shared chrome for every transactional email, reproducing
// lib/email/templates/layout.ts's styling (docs/specs/core-integrations.md,
// INT-13/INT-15) with react-email components instead of hand-built HTML
// strings. Not a public email itself, so it carries no subject/criterion of
// its own — every emails/*.tsx component composes these pieces.
//
// Inline styles throughout: mail clients strip <style> blocks and ignore CSS
// variables, so the app's design tokens are hardcoded to their hex
// equivalents here (amber #E8A849 on a light card). Emails render light
// regardless of the app's dark-first theme, because most clients do not
// honour prefers-color-scheme reliably.

const PRIMARY = "#E8A849";
const INK = "#1C2128";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const bodyStyle = {
  margin: 0,
  padding: "24px",
  backgroundColor: "#F5F5F4",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

const cardStyle = {
  maxWidth: "520px",
  margin: "0 auto",
  backgroundColor: "#FFFFFF",
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  padding: "32px",
};

const brandStyle = {
  margin: "0 0 24px",
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  color: PRIMARY,
};

const headingStyle = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: 1.3,
  color: INK,
};

const footerStyle = {
  maxWidth: "520px",
  margin: "16px auto 0",
  textAlign: "center" as const,
  fontSize: "12px",
  color: MUTED,
};

export interface EmailLayoutProps {
  heading: string;
  footer: string;
  children: ReactNode;
}

export function EmailLayout({ heading, footer, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={cardStyle}>
          <Text style={brandStyle}>BuyCarMap</Text>
          <Heading as="h1" style={headingStyle}>
            {heading}
          </Heading>
          {children}
        </Container>
        <Text style={footerStyle}>{footer}</Text>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text style={{ margin: "0 0 16px", fontSize: "15px", lineHeight: 1.6, color: INK }}>
      {children}
    </Text>
  );
}

export function MutedParagraph({ children }: { children: ReactNode }) {
  return (
    <Text style={{ margin: "0 0 12px", fontSize: "13px", lineHeight: 1.6, color: MUTED }}>
      {children}
    </Text>
  );
}

export function EmailButton({ label, url }: { label: string; url: string }) {
  return (
    <Button
      href={url}
      style={{
        display: "inline-block",
        margin: "0 0 24px",
        padding: "12px 20px",
        borderRadius: "8px",
        backgroundColor: PRIMARY,
        fontSize: "15px",
        fontWeight: 600,
        color: INK,
        textDecoration: "none",
      }}
    >
      {label}
    </Button>
  );
}

/** Long URLs must wrap or they blow out the card width on mobile clients. */
export function RawLink({ url }: { url: string }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "12px",
        lineHeight: 1.5,
        wordBreak: "break-all" as const,
      }}
    >
      <Link href={url} style={{ color: MUTED, textDecoration: "underline" }}>
        {url}
      </Link>
    </Text>
  );
}

export { INK, MUTED };
