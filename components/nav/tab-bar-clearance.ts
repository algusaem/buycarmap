// HEAD-18, HEAD-19 (docs/specs/redesign-navigation.md): the bottom padding a
// page that shows the phone tab bar gives its scrolling container below `lg`,
// so its last control scrolls fully clear of the bar. 88px is the bar's 64px
// tabs (MAPUI-52, docs/specs/redesign-map.md) plus 24px of air, and the bar
// adds the safe-area inset under its tabs, so the padding adds it too. Each
// page restores its own bottom padding from `lg`, where there is no tab bar.
// The value is app/globals.css's `--spacing-tab-clearance`.
export const TAB_BAR_CLEARANCE = "pb-tab-clearance";
