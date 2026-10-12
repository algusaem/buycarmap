// HEAD-18 (docs/specs/redesign-navigation.md): the bottom padding a page that
// shows the bottom nav gives its scrolling container below `lg`, so its last
// control scrolls fully clear of the floating bar. 110px is the design's
// (docs/design/canvas/F0-cuenta.dc.html): the bar's 62px, its 24px offset and
// 24px of air, plus the same safe-area inset the bar adds to its own offset
// (HEAD-17). Each page restores its own bottom padding from `lg`, where there
// is no bottom nav.
export const BOTTOM_NAV_CLEARANCE = "pb-[calc(110px+env(safe-area-inset-bottom))]";
