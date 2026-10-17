# 0022 — No unsaved-changes warning on the access forms and the account dialogs

Status: Accepted · Date: 2026-10-16 · Departs from `STACK.md` §14 (the unsaved-changes guard on navigation) and `RULES.md` §19 (Forms: "Warn on unsaved changes before navigation") for the forms named below

## Context

`STACK.md` §14 lists an unsaved-changes guard on navigation among the form rules, and `RULES.md`
§19 asks every form to warn on unsaved changes before navigation. The redesign's remaining pages
([docs/specs/redesign-pages.md](../specs/redesign-pages.md), F7) have two kinds of short form:

- the access forms: `/register` (email, password, its repeat), `/forgot-password` (email) and
  `/reset-password` (the new password, its repeat) — three fields at most;
- the account dialogs and sheets on `/account`: «Cambiar nombre», «Cambiar correo», «Cambiar
  contraseña», «Dos pasos» and «¿Eliminar tu cuenta?» — each one task, one to three fields.

Neither kind draws a warning on any board, and the owner was asked whether either should have one.

## Decided

**No unsaved-changes warning on these forms**, decided by the owner on 2026-10-16 after the build's
first review.

- The access forms: leaving `/register`, `/forgot-password` or `/reset-password` with something
  typed shows no warning. What is lost is at most three short fields, two of them a password a
  browser or a password manager does not keep anyway.
- The account dialogs: a dialog or sheet with something typed, closed by «Cancelar», Escape, a
  press outside or a drag down, closes with nothing sent and no warning (PAGES-38). Each is a short,
  single-purpose form opened from one card's button, and closing it is the way to say no.
- While a dialog's request runs it cannot be closed at all (PAGES-72); that is unchanged, and it is
  not a warning.

Every other form keeps the rule as `STACK.md` and `RULES.md` write it.

## Alternatives considered

- **A `beforeunload` prompt on the access forms**: the browser's own dialog, worded by the browser
  and not the app, for a loss of a few seconds' typing. It also fires on the form's own successful
  navigation unless every exit is special-cased.
- **A confirmation when a dirty dialog closes**: a second dialog over the first for a one-field
  edit, and the deletion confirmation would need a confirmation of its own cancel. It turns the
  common "never mind" into two presses.

## Consequences

- `/check-front` and `/check-good-practices` read this ADR as the exception for these forms; a new
  form elsewhere still needs the guard.
- `STACK.md` and `RULES.md` are unchanged: the departure is recorded here, as
  [0007](0007-adopt-core-rules.md) records the others.

## See also

- [docs/specs/redesign-pages.md](../specs/redesign-pages.md) › Decisions and rationale
- [0007](0007-adopt-core-rules.md)
