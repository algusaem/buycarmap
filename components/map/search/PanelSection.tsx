import type { ReactNode } from "react";
import { SectionLabel } from "./Combobox";

// docs/design/system/components/FilterSheet/README.md (Cuerpo) and
// SearchPopover/README.md (la hoja «BUSCAR»): a section of the filters panel
// or of the «BUSCAR» sheet. Its title is a heading one level under the
// panel's or the dialog's own, drawn as the `section-label`, over its fields.
interface PanelSectionProps {
  title: string;
  /** The title's heading level: one under the panel's or dialog's title. */
  level: 2 | 3 | 4;
  children: ReactNode;
}

export function PanelSection({ title, level, children }: PanelSectionProps) {
  const Heading = `h${level}` as const;

  return (
    <section className="flex flex-col gap-3">
      <Heading>
        <SectionLabel>{title}</SectionLabel>
      </Heading>
      {children}
    </section>
  );
}
