/**
 * docs/specs/redesign-pages.md (PAGES-73, PAGES-76): a callback ref that moves
 * the focus to its element when the element mounts — a state that gave way to
 * another, a dialog's own first control. A module-level function, so its
 * identity never changes and React calls it once per mount, never again on a
 * re-render.
 */
export function focusOnMount(node: HTMLElement | null): void {
  node?.focus();
}
