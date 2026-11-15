# Search the map by description

Key: DESC
Status: Implemented
Last updated: 2026-11-01

---

## Problem

A buyer often knows the car by a word that is neither a make nor a model: a generation («e46»), a
trim («gti»), a body («cabrio»). Wallapop and coches.net both search those words. BuyCarMap sends
them to every source, but the map has no control to type one: the only way in is a hand-written
`/map?q=e46`, and even then the page does not show that the text is applied. Someone who wants an
E46 has to pick BMW, then Serie 3, then scroll past every generation, or leave for the marketplace.

The text box was removed in the 2.0 redesign because it mixed everything into one field: «golf
madrid» reached the map as text instead of a place and a car. That was a reason to stop mixing, not
a reason to stop searching.

In scope: a «Descripción» field of its own, separate from «Coche», on the map's filter row and in
the phone «BUSCAR» sheet; how it reaches the URL and the search; how it clears; and alerts saving
it. The design is accepted: `docs/design/canvas/F3-buscador-texto.dc.html`,
`F3-mapa-texto.dc.html`, `F3-crear-alerta-texto.dc.html`, `F6-alerta-descripcion.dc.html`, and the
Descripción section of `docs/design/system/components/SearchPill/README.md`.

## Acceptance criteria

**The field**

- [x] DESC-1 · component — From 1024px wide, the filter row ends with a divider and a field named
  «Buscar en la descripción», showing «Descripción: e46, gti…» while empty. Both widths draw the
  same row.
- [x] DESC-2 · component — The «BUSCAR» sheet has a «Descripción» section between «Coche» and
  «Precio», with the same field and no list of suggestions.
- [x] DESC-3 · component — The «Coche» field, its lists and its no-match line behave as they did:
  text typed there never becomes a description, and text typed in «Descripción» never changes the
  brand or the model.
- [x] DESC-4 · component — On the filter row, the field shows the applied text. With text applied
  its border is `violet` and its weight 800; typing over that text returns both to the plain state.
  With focus the border is `lime` and the weight stays as it was; text typed and not applied, with
  no focus, has the plain `line` border. With text in it, a «Borrar texto» button shows at its end.
  The sheet's field has no applied state.
- [x] DESC-5 · component — Text longer than 100 characters cannot be typed or pasted into the field:
  it stops at 100.

**Applying it**

- [x] DESC-6 · unit — On the filter row, Enter applies the trimmed text: one search runs at once, with
  no debounce, and the URL gains `q` as a new history entry. Inner runs of spaces stay as typed.
- [x] DESC-7 · unit — Pressing Enter with the applied text unchanged runs no search and adds no
  history entry.
- [x] DESC-8 · component — On the filter row, the lime «Buscar» applies what the field holds, as
  «Ver coches» does in the sheet; leaving the field without Enter or «Buscar» applies nothing and
  runs no search. Focus stays in the field after Enter, and returns to it after «Borrar texto», in
  the row and in the sheet.
- [x] DESC-9 · component — «Borrar texto» empties the field; if the field held applied text, or
  text typed over applied text, the applied text is cleared, it runs one search without it and
  removes `q` from the URL; with nothing applied it runs nothing.
- [x] DESC-10 · unit + component — Emptying the field by hand and pressing Enter, or leaving only spaces and
  pressing Enter, clears the applied text the same way.
- [x] DESC-11 · unit — The text adds to every other criterion: the search carries it with the place,
  brand, model, price and filters, and changing any of those keeps it.

**In the sheet**

- [x] DESC-12 · component — In the «BUSCAR» sheet the field opens with the applied text. «Ver coches»
  applies what the field holds, with no need to confirm it first; Enter in the field does the same
  as «Ver coches».
- [x] DESC-13 · component — Closing the sheet discards what was typed. «Borrar» empties the field,
  which takes effect on «Ver coches», as with the sheet's other fields.
- [x] DESC-14 · component — On the landing's phone sheet, «Ver coches» carries the text to `/map` as
  `q`, with the rest of the search. The landing's desktop pill and its popular cars produce no `q`.

**State around it**

- [x] DESC-15 · unit — A URL with `q` fills the field and searches with it, on load and on reload.
  Back and Forward restore the field and the search together, discarding any text typed and not
  applied.
- [x] DESC-16 · unit — `q` holding only spaces is no text: the field is empty, the search carries no
  keywords, and it does not count as a filter for the empty state.
- [x] DESC-17 · unit — The text does not count in the «Filtros» badge and does not appear in the Coche
  value of the pill.
- [x] DESC-18 · unit — The phone summary line shows the text in «…» after the car and before the
  price: «BMW · «e46» · hasta 20.000 €», or «Cualquier marca · «e46» · hasta 20.000 €» with no brand.
- [x] DESC-19 · component — With text applied and no results, the map shows the filtered empty state,
  and «Quitar filtros» clears the text, the field and `q` along with the filters, discarding also
  any text typed and not applied. So does «Borrar» in the filters panel.
- [x] DESC-20 · component — A failed search with text applied keeps the text in the field and in the
  URL, and retrying searches with it.

**Alerts**

- [x] DESC-21 · unit — An alert saved from a search with text keeps it: the prefilled name is
  «BMW e46 · Madrid» and the summary «BMW · «e46» · Hasta 20.000 € · Madrid · 50 km». With no brand,
  the name starts with the text («e46 · Madrid») and the summary with «Cualquier marca · «e46»».
- [x] DESC-22 · node — `createAlert`, against the real Postgres of the integration project, stores the trimmed text in the criteria and hashes it
  with them, so two alerts differing only in the text are two criteria rows, and the same text from
  two users is one.
- [x] DESC-23 · unit — Criteria with no text hash exactly as they do today: `keywords` absent, empty or
  only spaces all give the hash of the criteria without it, so an existing alert is still «Ya tienes
  esta alerta».
- [x] DESC-24 · unit — The text alone does not satisfy «Demasiado amplia»: criteria with only `keywords`
  are refused, and adding a brand, a maximum price or a place accepts them.
- [x] DESC-25 · node — `createAlert` rejects text longer than 100 characters as invalid criteria.
- [x] DESC-26 · node — The alert poll sends the stored text to the sources with the other criteria.

- [x] DESC-30 · unit — The alert card and the alert's page list the saved text as its own criterion, in
  «…» right after the car: `["BMW", "«e46»", "Hasta 20.000 €", "Madrid · 50 km"]`. With no brand it
  comes first. An alert with no text lists what it does today.
- [x] DESC-31 · node — An alert whose text holds a character Postgres cannot store in `jsonb` (U+0000 or a lone surrogate) is refused with `invalidCriteria`, not a server error.
- [x] DESC-32 · unit — Events and breadcrumbs sent to Sentry from the browser, the server and edge
  carry no query string, so `q`, `lat` and `lng` never reach it.

**Layout and access**

- [x] DESC-27 · e2e — At 1440px and wider, row two starts at the left edge of the search group and the
  field does not move the search group. Between 1024px and 1439px the row stays centred on the window.
  No width from 1024px up has horizontal overflow, with the badge at its longest.
- [x] DESC-28 · e2e — In the desktop tab order the field comes right after the last quick filter, and
  its «Borrar texto», when it shows, right after the field.
- [x] DESC-29 · e2e — The whole flow on `/map`: type «e46», press Enter, the URL has `q=e46`, reload
  keeps it in the field, «Borrar texto» removes it.
- [x] DESC-33 · component — Escape in the row's field discards what was typed: the field shows the
  applied text again and no search runs. It behaves the same in every browser.
- [x] DESC-34 · node — Pino's `redact` paths cover `keywords` and `criteria`, top-level and nested.

## Worked examples

No criterion is on the critical list; these fix the exact strings and URLs, all from the accepted
design.

- DESC-6: on `/map?make=BMW`, typing `  e46 ` and pressing Enter gives `/map?make=BMW&q=e46` and one
  search with `{ brand: "BMW", keywords: "e46" }`.
- DESC-15: `/map?q=e46`, «Borrar texto», a client-side visit to `/` and Back: the field is empty and
  the URL has no `q`.
- DESC-18: brand BMW, maximum 20.000 €, text `e46`: «BMW · «e46» · hasta 20.000 €».
- DESC-21: brand BMW, place Madrid, 50 km, maximum 20.000 €, text `e46`: name «BMW e46 · Madrid»,
  summary «BMW · «e46» · Hasta 20.000 € · Madrid · 50 km».
- DESC-24: `{ keywords: "e46" }` is refused as too broad; `{ brand: "BMW", keywords: "e46" }` is
  accepted.
- DESC-31: `{ brand: "BMW", keywords: "a\u0000b" }` is refused with `invalidCriteria`.
- DESC-32: `https://buycarmap.test/map?q=e46&lat=40.4` reaches Sentry as
  `https://buycarmap.test/map`; a navigation breadcrumb from `/map?q=e46` to `/map?q=gti` reaches it
  as from `/map` to `/map`. A server event with `contexts.nextjs.request_path` `/map?q=e46` reaches
  Sentry as `/map`; a `console` breadcrumb with message `Failed to fetch RSC payload for
  /map?q=e46.` reaches it as `Failed to fetch RSC payload for /map.`, with no `data.arguments`. A
  `console` breadcrumb with message `Failed to fetch RSC payload for /map?lat=40.4168&lng=-3.7038&q=e46.`
  reaches Sentry as `Failed to fetch RSC payload for /map.`, and `Failed to fetch RSC payload for
  /map?q=2.0+tdi. Falling back to browser navigation.` as `Failed to fetch RSC payload for /map.
  Falling back to browser navigation.`; a dot inside the query is part of the query. A stack frame
  with filename `https://buycarmap.test/map?q=e46&lat=40.4` reaches Sentry as
  `https://buycarmap.test/map`.

## Data model

No schema change and no migration. `AlertCriteria.criteria` is JSON and already parses `keywords`
back (`parseStoredCriteria`); only `withoutUnsavedCriteria` kept it out before this change.
`AlertCriteria` rows stay shared across users and unlinked from them. Rows saved before MAPUI-42
that hold `keywords` keep their hash, because existing rows are never rehashed.

The text counts as personal data (owner decision, 2026-10-31): a person types it, so a name or a phone number could end up in it. `docs/privacy/data-inventory.md` records it on `AlertCriteria.criteria`, with that row's existing retention: while any alert references it. Export and deletion already cover the row, and no log carries it. Pino's `redact` paths gain `keywords` and `criteria`.

## Permissions

The field adds no permission. `createAlert` keeps its session check, its ownership rules and its
cap of 20 alerts per user (`createAlert` has no rate limit); DESC-22 and DESC-25 only change what
its criteria may hold. The text is untrusted input: it reaches the upstreams encoded
(`URLSearchParams`, `JSON.stringify`) and is never rendered as HTML.

## Edge cases

- Very long text from a link: `/map?q=` with more than 100 characters still searches, as an old link
  did; the limit is on typing (DESC-5) and on saving (DESC-25). The field shows it whole.
- Saving an alert from such a link fails with the invalid-criteria error (DESC-25).
- Only spaces (DESC-10, DESC-16, DESC-23).
- Enter with nothing changed (DESC-7).
- A search in flight when Enter is pressed: the existing version guard drops the older response.
  Pagination keeps its own text, as MAP covers.
- No results (DESC-19). One source failing keeps the partial results, as today; all failing, DESC-20.
- Text that differs only in case or accents («E46», «e46») is two criteria rows: accepted, see
  Decisions.
- The filter row is mounted but hidden below 1024px; phones use the sheet alone.
- A tablet at 1024px or wider gets the row: see Decisions on the field's font size.

## Out of scope

- Filtering the results by the text on our side. There is no text post-filter.
- Highlighting the matched words, or showing listing descriptions.
- Suggestions, history or popular searches in the field.
- A description field on the landing's desktop pill, or free text in the popular cars.
- Parsing the text into a brand, a model or a place.
- Ranking results by how well they match.
- Showing the text in the digest email beyond the alert's name.

## Contracts

**URL.** `q` is the existing `KEYWORDS_PARAM`. Not one of `searchParsers`; `/map?q=…` from an old
link keeps working.

**Upstreams.** Unchanged: `keywords` (Wallapop), `searchText` (coches.net), `palabras` joined with the
model (Milanuncios). The live behaviour below goes in `docs/specs/data-sources.md`.

**i18n.**

| Key | es | en |
| --- | --- | --- |
| `search.descriptionLabel` | Descripción | Description |
| `search.descriptionField` | Buscar en la descripción | Search the description |
| `search.descriptionPlaceholder` | Descripción: e46, gti… | Description: e46, gti… |

«Borrar texto» reuses `search.clearText`.

**Criteria amended** (in the same change):

- MAPUI-18: `?q=` leaves the list of criteria with no control.
- MAPUI-20: the summary's second line, with DESC-18.
- MAPUI-21: the sheet has four sections.
- MAPUI-42, its edge case, its contract and its rationale: alerts save the text; only `timeFilter`
  is stripped.
- MAPUI-13, MAPUI-63, MAPUI-64 and MAPUI-70, and the worked example of row two's centre: the row's
  content and alignment, with DESC-27.
- ENTRY-6 and its contract and rationale: the landing's phone sheet may produce `q`; the pill and the
  popular cars still do not.
- FRONT-13: the search is also set through the description field.
- ALERTUI-5 and its edge case: with DESC-30, the stored text shows.
- A11Y-3's worked example: the tab order gains the field.
- A11Y-4: the field's focus outline, drawn on its pill.
- LOOK-13: the 34px field joins its exceptions.
- PLAT-15: `keywords` and `criteria` join the `redact` paths it tracks.

`docs/ARCHITECTURE.md` and the code comments that say nothing produces `?q=` change with them.

## Decisions and rationale

**A field of its own, not part of «Coche».** The first design put the text as a last option of the
«Coche» list. The owner rejected it (2026-10-31): a brand or a model is a strict filter every source
honours, and the text is a loose match. Sharing a field hides which of the two you got, and it is
what made the old landing box fail.

**On the filter row, not a fourth pill segment.** The pill and the navigation already fill row one
at 1440px: a fourth segment needs about 120px that row one does not have. Row two has room.

**Row two is left-aligned at 1440px and wider, and spans to the end of the band.** In its old `auto`
column a wider row would widen the column and push the pill. Spanning `2 / -1` and starting at the
group's left edge keeps «Filtros» where it was, and its dropdown with it.

**Enter applies, not every keystroke.** Each search fans out to three marketplaces, and a half-typed
word is a useless query. The price and the chips debounce because their intermediate values are
still valid searches; «e» is not.

**The name is «Descripción».** Owner's word (2026-10-31). It is not literally exact: what each source
matches is theirs, and coches.net gives us no description text at all. It says what a buyer means:
the words in the ad.

**No text post-filter, unlike radius, model and fuel.** `docs/specs/data-sources.md` owns the live
numbers from the 2026-10-31 probe of `/map?q=e46` in production; neither matched it exactly. A
filter on our side would need text we do not have: coches.net sends no
description, so it could only judge the title, and it would throw away what Wallapop found in the
ad's body. The owner accepted the noise: the marketplaces behave the same.

**Alerts save the text, reversing MAPUI-42.** MAPUI-42 dropped it because the map no longer showed it.
Now it does, and alerts.md's own rule applies: an alert is a saved search and must not promise less
than the search it came from. The text is only trimmed. Lower-casing «E46» would assume something
about how every source treats case that nobody has probed, and being wrong means a search that
stops matching. A second row costs one more poll.

**The alert shows the text it saved.** ALERTUI-5 hid it because it was never saved on purpose. With it saved, two alerts differing only in the text would look identical apart from their name (owner decision, 2026-10-31).

**The text alone stays «Demasiado amplia».** One word across Spain can flood a digest with noise, and
adding a brand, a price or a place is one tap.

**The limit is 100 characters.** Search boxes need no more, and alert criteria are stored and hashed,
so they need a bound. `searchSchema` keeps no limit, so an old link never turns into an error.

**Enter in the sheet does what «Ver coches» does.** The phone keyboard's search key must do something,
and the sheet has no other meaning for it.

**The field's font size.** The design draws 13px, under the 16px that stops iOS zooming on focus. The
row renders only from 1024px, but an iPad in landscape gets it, so on a coarse pointer the field uses
16px at the same height. Nothing changes with a mouse.
