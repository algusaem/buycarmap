// The Navigation API's current history entry, which lib/hooks/useSavedList.ts
// keys the saved list's restored scroll by (docs/specs/redesign-saved.md,
// SAVED-27), and the event that says it changed, which carries /alerts' column
// scroll to the entry a press pushes (docs/specs/redesign-alerts.md,
// ALERTUI-56). TypeScript's DOM lib does not declare the API yet, and a
// browser without it leaves `window.navigation` undefined.
interface Window {
  readonly navigation?: {
    readonly currentEntry: { readonly key: string } | null;
    addEventListener(type: "currententrychange", listener: () => void): void;
    removeEventListener(type: "currententrychange", listener: () => void): void;
  };
}
