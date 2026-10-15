// The Navigation API's current history entry, which lib/hooks/useSavedList.ts
// keys the saved list's restored scroll by (docs/specs/redesign-saved.md,
// SAVED-27). TypeScript's DOM lib does not declare the API yet, and a browser
// without it leaves `window.navigation` undefined.
interface Window {
  readonly navigation?: { readonly currentEntry: { readonly key: string } | null };
}
