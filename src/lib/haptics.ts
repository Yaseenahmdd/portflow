/**
 * Haptic feedback patterns for mobile PWA interactions.
 * Uses the Vibration API (navigator.vibrate) — silently no-ops
 * on browsers/devices that don't support it.
 */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/** Light 10ms tap — standard buttons, menu opens, navigation */
export function tap() {
  vibrate(10);
}

/** Very subtle 5ms pulse — form focus, micro-interactions */
export function subtle() {
  vibrate(5);
}

/** Double-pulse toggle — visibility, theme, mode switches */
export function toggle() {
  vibrate([10, 30, 10]);
}

/** Stronger initial pulse — destructive intent (first tap on delete) */
export function medium() {
  vibrate([15, 30]);
}

/** Ascending pattern — successful form submit, import, refresh complete */
export function success() {
  vibrate([10, 20, 30]);
}

/** Strong warning double-pulse — confirmed destructive action */
export function destructive() {
  vibrate([20, 40, 20]);
}

/** Pull-to-refresh threshold crossed */
export function threshold() {
  vibrate([15, 40, 10]);
}
