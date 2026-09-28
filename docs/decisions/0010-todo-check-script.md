# 0010 — The TODO ban is a lint script, not a Biome rule

## Decided

`STACK.md` §5 asks Biome to ban a TODO without an issue reference. Biome 2.5 has no such rule, so
`scripts/todo-check.mjs` runs in `pnpm lint` (TOOLING-12), finding comments through TypeScript's
syntactic classification for scripts and `/* */` blocks for CSS, and reporting a comment line with
the marker and no `#<number>` in that comment line.

## What it beat

**A regex per line.** It flags the marker inside a string and misses one split across a block
comment.

**A hand-rolled scanner.** It lost comments after a regex literal — its own bracket-matching had
no way to tell a regex from a division, so it misread the rest of the file.

**An AST walk.** It missed a comment sitting right before a closing bracket and a comment inside a
JSX expression container, because neither position has a node whose leading or trailing trivia the
walk visits.

## What it costs

A script to maintain, and `typescript` loaded by `lint`.

## What would change our mind

A Biome rule (or plugin) that expresses this. Then the script and TOOLING-12's mechanism go.
