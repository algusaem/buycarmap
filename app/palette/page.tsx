"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import { ArrowUpRight, Heart, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CheckboxSelect } from "@/components/ui/checkbox-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";

// Internal style guide for the BuyCarMap 2.0 system (docs/design/system/).
// It renders every primitive for e2e/foundation.spec.ts to measure (LOOK-9 to
// LOOK-14) and lists every token of app/globals.css `:root` with its value
// (LOOK-20). The token list mirrors docs/design/system/tokens.json verbatim.

interface Token {
  name: string;
  value: string;
}

const COLOR_TOKENS: Token[] = [
  { name: "--bg", value: "#0F0F10" },
  { name: "--surface", value: "#18181B" },
  { name: "--surface-strong", value: "#1E1E22" },
  { name: "--line", value: "#2A2A2E" },
  { name: "--line-soft", value: "#232326" },
  { name: "--text", value: "#F4F2F0" },
  { name: "--text-muted", value: "#A3A0A6" },
  { name: "--text-legal", value: "#D6D3D8" },
  { name: "--lime", value: "#C6FF3D" },
  { name: "--on-lime", value: "#0F0F10" },
  { name: "--violet", value: "#7C4DFF" },
  { name: "--on-violet", value: "#FAF9F8" },
  { name: "--danger", value: "#FF5C5C" },
  { name: "--lime-glow", value: "rgba(198, 255, 61, 0.2)" },
  { name: "--map-ground", value: "#141416" },
  { name: "--map-road", value: "#232327" },
  { name: "--map-road-major", value: "#2B2B30" },
  { name: "--map-road-minor", value: "#1C1C20" },
  { name: "--map-water", value: "#111A22" },
  { name: "--photo-placeholder", value: "#2A2B30" },
  { name: "--photo-tint-1", value: "#2A2D33" },
  { name: "--photo-tint-2", value: "#302C2A" },
  { name: "--photo-tint-3", value: "#29302C" },
  { name: "--photo-tint-4", value: "#2D2A33" },
  { name: "--photo-tint-5", value: "#2A2F33" },
  { name: "--photo-tint-6", value: "#322E2A" },
  { name: "--photo-tint-7", value: "#2B2E34" },
  { name: "--photo-tint-8", value: "#2E2B30" },
  { name: "--photo-icon", value: "rgba(244, 242, 240, 0.2)" },
  { name: "--scrim", value: "rgba(15, 15, 16, 0.85)" },
  { name: "--handle", value: "#3A3A40" },
  { name: "--google-bg", value: "#131314" },
  { name: "--google-line", value: "#8E918F" },
  { name: "--google-text", value: "#E3E3E3" },
  { name: "--google-badge", value: "#FFFFFF" },
];

const RADIUS_TOKENS: Token[] = [
  { name: "--radius-pill", value: "999px" },
  { name: "--radius-card", value: "22px" },
  { name: "--radius-field", value: "16px" },
  { name: "--radius-sheet", value: "26px" },
  { name: "--radius-panel", value: "28px" },
  { name: "--radius-preview", value: "24px" },
  { name: "--radius-thumb", value: "18px" },
  { name: "--radius-option", value: "12px" },
  { name: "--radius-skeleton", value: "8px" },
  { name: "--radius-skeleton-sm", value: "6px" },
];

const SHADOW_TOKENS: Token[] = [
  { name: "--shadow-float", value: "0 24px 50px rgba(0, 0, 0, 0.55)" },
  { name: "--shadow-pin-active", value: "0 0 0 7px rgba(198, 255, 61, 0.2)" },
  { name: "--shadow-current", value: "0 0 0 3px #0F0F10, 0 0 0 5px #F4F2F0" },
  { name: "--shadow-current-sm", value: "0 0 0 2px #0F0F10, 0 0 0 4px #F4F2F0" },
];

const FUEL_OPTIONS = [
  { value: "gasolina", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "hibrido", label: "Híbrido" },
  { value: "electrico", label: "Eléctrico" },
  { value: "glp", label: "GLP" },
];

const noop = () => {
  /* Style guide only: the sample controls do nothing. */
};

export default function PalettePage() {
  const [fuel, setFuel] = useState(["gasolina", "diesel", "hibrido"]);

  return (
    <div className="flex-1 overflow-y-auto bg-bg px-5 py-6 font-sans text-text md:px-12 md:py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <h1 className="font-display text-3xl font-black uppercase">Paleta</h1>

        <Section title="Botones">
          <div className="w-full max-w-md">
            <Button data-testid="btn-display" size="display">
              Ver coches
            </Button>
          </div>
          <Row>
            <Button data-testid="btn-primary-54" variant="primary" size="54">
              <Search aria-hidden="true" strokeWidth={2.6} className="size-4.25" />
              Buscar
            </Button>
            <Button data-testid="btn-primary-52" variant="primary" size="52">
              Buscar
            </Button>
            <Button data-testid="btn-primary-48" variant="primary" size="48">
              Ampliar a 100 km
            </Button>
            <Button data-testid="btn-primary-42" variant="primary" size="42">
              Ver anuncio
              <ArrowUpRight aria-hidden="true" strokeWidth={2.6} className="size-3.75" />
            </Button>
            <Button data-testid="btn-icon" variant="icon" size="icon" aria-label="Guardar">
              <Heart aria-hidden="true" />
            </Button>
            <Button data-testid="btn-icon-40" variant="icon" size="icon-40" aria-label="Cerrar">
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          </Row>
          <Row>
            <Button data-testid="btn-secondary-48" variant="secondary" size="48">
              Volver al mapa
            </Button>
            <Button data-testid="btn-secondary-44" variant="secondary" size="44">
              Cambiar correo
            </Button>
            <Button data-testid="btn-ghost" variant="ghost" size="pad-14">
              Crear alerta
            </Button>
            <Button data-testid="btn-undo" variant="undo" size="48">
              Quitar filtros
            </Button>
            <Button data-testid="btn-danger" variant="danger" size="44">
              Eliminar mi cuenta
            </Button>
          </Row>
        </Section>

        <Section title="Chips">
          <Row>
            <ToggleChip data-testid="chip-pressed" label="Todos" active onClick={noop} />
            <ToggleChip data-testid="chip-unpressed" label="Diésel" active={false} onClick={noop} />
          </Row>
        </Section>

        <Section title="Campos">
          <div className="grid w-full gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="palette-email" className="text-[13px] font-bold text-text">
                Email
              </Label>
              <Input
                id="palette-email"
                data-testid="field-input"
                type="email"
                name="email"
                autoComplete="off"
                placeholder="tu@correo.com…"
              />
            </div>
            <CheckboxSelect
              data-testid="field-checkbox-select-trigger"
              label="Combustible"
              options={FUEL_OPTIONS}
              value={fuel}
              onChange={setFuel}
              placeholder="Cualquiera"
            />
          </div>
        </Section>

        <Section title="Aviso">
          <Button
            data-testid="toast-demo"
            variant="secondary"
            size="44"
            onClick={() =>
              toast("Guardado en tus coches.", { action: { label: "Deshacer", onClick: noop } })
            }
          >
            Mostrar aviso
          </Button>
        </Section>

        <Section title="Colores">
          <ul className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_TOKENS.map((token) => (
              <TokenRow
                key={token.name}
                token={token}
                swatch={{ background: `var(${token.name})` }}
              />
            ))}
          </ul>
        </Section>

        <Section title="Radios">
          <ul className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RADIUS_TOKENS.map((token) => (
              <TokenRow
                key={token.name}
                token={token}
                swatch={{ borderRadius: `var(${token.name})` }}
              />
            ))}
          </ul>
        </Section>

        <Section title="Sombras">
          <ul className="grid w-full gap-3 sm:grid-cols-2">
            {SHADOW_TOKENS.map((token) => (
              <TokenRow
                key={token.name}
                token={token}
                swatch={{ boxShadow: `var(${token.name})` }}
              />
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function TokenRow({ token, swatch }: { token: Token; swatch: CSSProperties }) {
  return (
    <li className="flex items-center gap-3 rounded-field border border-line bg-surface p-3">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-option border border-line bg-surface-strong"
        style={swatch}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold">{token.name}</span>
        <span className="truncate text-xs text-text-muted tabular-nums">{token.value}</span>
      </span>
    </li>
  );
}
