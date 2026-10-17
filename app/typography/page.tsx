import type { CSSProperties } from "react";

// Internal style guide for the BuyCarMap 2.0 type system
// (docs/design/system/tokens.json › type): Unbounded for display, always in
// capitals, and Rethink Sans for everything else. Each style below mirrors its
// tokens.json entry verbatim.

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: number | "normal";
  fontWeight: number;
  letterSpacing?: string;
  sample: string;
}

const DISPLAY_STYLES: TypeStyle[] = [
  {
    name: "hero",
    fontSize: "72px",
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: "-0.01em",
    sample: "MIRA EL MAPA",
  },
  {
    name: "hero-setup",
    fontSize: "40px",
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "0",
    sample: "¿EN BUSCA DE COCHE?",
  },
  {
    name: "hero-mobile",
    fontSize: "34px",
    lineHeight: 1.06,
    fontWeight: 900,
    letterSpacing: "-0.01em",
    sample: "MIRA EL MAPA",
  },
  {
    name: "empty-title",
    fontSize: "48px",
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: "-0.01em",
    sample: "AMPLÍA EL RADIO",
  },
  {
    name: "page-title",
    fontSize: "40px",
    lineHeight: 0.9,
    fontWeight: 900,
    letterSpacing: "-0.015em",
    sample: "GUARDADOS",
  },
  {
    name: "page-title-mobile",
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "0",
    sample: "GUARDADOS",
  },
  {
    name: "form-title",
    fontSize: "26px",
    lineHeight: "normal",
    fontWeight: 800,
    letterSpacing: "0",
    sample: "ENTRAR",
  },
  {
    name: "legal-h1",
    fontSize: "48px",
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "0",
    sample: "PRIVACIDAD",
  },
  {
    name: "legal-h2",
    fontSize: "20px",
    lineHeight: "normal",
    fontWeight: 800,
    letterSpacing: "0",
    sample: "UBICACIÓN",
  },
  {
    name: "count",
    fontSize: "30px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    sample: "COCHES",
  },
  {
    name: "price",
    fontSize: "22px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "0",
    sample: "14.500 €",
  },
  {
    name: "wordmark",
    fontSize: "20px",
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "0",
    sample: "BUYCARMAP",
  },
  {
    name: "button-display",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "0",
    sample: "VER COCHES",
  },
];

const TEXT_STYLES: TypeStyle[] = [
  {
    name: "lead",
    fontSize: "19px",
    lineHeight: 1.5,
    fontWeight: 400,
    sample: "Una web, toda la segunda mano, sin cincuenta pestañas.",
  },
  {
    name: "lead-mobile",
    fontSize: "16px",
    lineHeight: 1.5,
    fontWeight: 400,
    sample: "Una web, toda la segunda mano, sin cincuenta pestañas.",
  },
  {
    name: "body",
    fontSize: "16px",
    lineHeight: 1.5,
    fontWeight: 400,
    sample: "Wallapop · Zaragoza",
  },
  {
    name: "body-15",
    fontSize: "15px",
    lineHeight: 1.5,
    fontWeight: 400,
    sample: "Tus datos, tus reglas.",
  },
  {
    name: "legal-body",
    fontSize: "17px",
    lineHeight: 1.65,
    fontWeight: 400,
    sample: "Guardamos tu correo y lo que decides guardar.",
  },
  {
    name: "card-title",
    fontSize: "16px",
    lineHeight: 1.25,
    fontWeight: 700,
    sample: "Audi A3 2.0 TDI",
  },
  { name: "label", fontSize: "14px", lineHeight: 1.3, fontWeight: 700, sample: "Crear alerta" },
  { name: "field-label", fontSize: "13px", lineHeight: "normal", fontWeight: 700, sample: "Email" },
  {
    name: "meta",
    fontSize: "14px",
    lineHeight: 1.4,
    fontWeight: 400,
    sample: "2018 · 95.000 km · Diésel",
  },
  {
    name: "small",
    fontSize: "13px",
    lineHeight: "normal",
    fontWeight: 400,
    sample: "2019 · 71.000 km",
  },
  { name: "caption", fontSize: "12px", lineHeight: 1.3, fontWeight: 700, sample: "Wallapop" },
  {
    name: "overline",
    fontSize: "11px",
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: "0.08em",
    sample: "DÓNDE",
  },
  {
    name: "section-label",
    fontSize: "12px",
    lineHeight: "normal",
    fontWeight: 700,
    letterSpacing: "0.08em",
    sample: "COMBUSTIBLE",
  },
];

export default function TypographyPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-bg px-5 py-6 font-sans text-text md:px-12 md:py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <h1 className="font-display text-3xl font-black uppercase">Tipografía</h1>

        <StyleGroup title="Display · Unbounded" family="font-display" styles={DISPLAY_STYLES} />
        <StyleGroup title="Texto · Rethink Sans" family="font-sans" styles={TEXT_STYLES} />
      </div>
    </div>
  );
}

function StyleGroup({
  title,
  family,
  styles,
}: {
  title: string;
  family: "font-display" | "font-sans";
  styles: TypeStyle[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-line-soft rounded-card border border-line bg-surface">
        {styles.map((style) => (
          <StyleRow key={style.name} style={style} family={family} />
        ))}
      </ul>
    </section>
  );
}

function StyleRow({ style, family }: { style: TypeStyle; family: "font-display" | "font-sans" }) {
  const sampleStyle: CSSProperties = {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
  };

  return (
    <li className="flex flex-col gap-2 p-5 md:flex-row md:items-baseline md:gap-6">
      <span className="w-44 shrink-0 text-xs text-text-muted tabular-nums">
        {style.name} · {style.fontSize} / {style.fontWeight}
      </span>
      <p className={`${family} min-w-0 break-words`} style={sampleStyle}>
        {style.sample}
      </p>
    </li>
  );
}
