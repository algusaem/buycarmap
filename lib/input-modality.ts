// docs/specs/motion.md (MOTION-10 to MOTION-15): which kind of input the
// person used last — a key or a pointer press anywhere on the page — read when
// something opens, closes or moves, so a keyboard action does it at once while
// a pointer keeps the motion. A close nobody triggered usually follows the
// same last input too (spec Edge cases) — except the map preview whose car
// leaves the results, which always goes at once: it leaves with its pin, and
// pins never animate.
//
// One listener pair on `window`, in the capture phase so a handler that stops
// the event still leaves it recorded, installed once when this module first
// loads in the browser.

type InputKind = "keyboard" | "pointer";

/** Keys that only modify another key (or a pointer press) are not an input of their own. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

let lastInput: InputKind = "pointer";

function install() {
  window.addEventListener(
    "keydown",
    (event) => {
      if (MODIFIER_KEYS.has(event.key)) return;
      lastInput = "keyboard";
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    () => {
      lastInput = "pointer";
    },
    true,
  );
}

if (typeof window !== "undefined") install();

/** Whether the last key or pointer press on the page was a key. */
export function lastInputWasKeyboard(): boolean {
  return lastInput === "keyboard";
}
