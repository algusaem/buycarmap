# Surface brief: the legal pages

`/privacy` and `/terms` of BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-pages.md`](../../docs/specs/redesign-pages.md) (PAGES-61 to PAGES-64,
PAGES-69, PAGES-70, PAGES-74) and `docs/specs/core-frontend.md` (FRONT-27, the content rules); the
visual source of truth is the design in [`docs/design/`](../../docs/design/README.md) (boards
`F0-legal`, `F7-legal-estados`, the LegalToc README). Where this brief and the design disagree, the
design wins and this brief is corrected.

## 1. Job and audience

- Anyone, signed in or not, reading what BuyCarMap does with their data or the terms of use, often
  from the register form's legal notice or the footer; a deep link to one section.
- Mode: Read — long text, findable sections, nothing in the way.

## 2. Outcome and proof

- The reader finds a section from the index and lands on its heading, clear of the header
  (PAGES-62, PAGES-64).
- Evidence on screen: «Privacidad» or «Términos» as the `h1`, «Última actualización: <fecha>», the
  intro, then each section as an `h2` with its own stable id (PAGES-61, PAGES-74).

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world (`DESIGN.md`): `bg`, the legal type styles
  (`legal-h1`, `legal-h2`, `legal-body`), `text-legal` for the reading text.
- Structural thesis: from `lg`, the 260px index beside a reading column of at most 720px (596px at
  1024px); on a phone one column with the index folded after the date (PAGES-63, PAGES-64).
- Focal moment: the text itself; the index stays put and marks the section on screen.

## 4. Scope and boundaries

- In scope: the layout, the index, the anchors, the title and the date line.
- Untouched here: the sections' content, which stays the message files' text (FRONT-27).
- Anti-goals: no «Volver al inicio» link; no footer fixed to the bottom; no anchor built from a
  heading (PAGES-74).

## 5. States and ranges

- Desktop index: one link per section, the one on screen in `text` with the lime bar and
  `aria-current="location"`, the rest muted (PAGES-62).
- Phone index: folded (`aria-expanded="false"`), open inside the same field, folding again after a
  section is pressed (PAGES-63).
- A deep link: the page opens on that heading, marked current (PAGES-64).

## 6. Interaction and layout

- The phone index folds over 180ms when a pointer chooses a section and at once when a key does,
  then the page jumps (`docs/specs/motion.md`, MOTION-15); scrolling moves the current mark, never
  the index.
- Every index link is a 44px target on a phone.

## 7. Constraints and open decisions

- WCAG 2.2 AA; both pages pass axe at 1440×900 and 390×844 (PAGES-70).
- All copy through next-intl keys, the same ids in both locales.
- Reuse `LegalContent`, `LegalToc`, `useLegalToc` and the theme tokens.
- Not for the builder to invent: any copy, value or state the design and the PAGES spec do not give.
