/**
 * Which state names Learn mode prints on the map.
 *
 * - Keep names OFF (default): only the last state she tapped is labeled,
 *   and the label moves when she taps another state.
 * - Keep names ON: every state she taps keeps its label, so the labels build
 *   up as she explores (until "Clear names").
 */

/** Add a state to the kept-names list (no duplicates, tap order preserved). */
export function keepLabel(kept: readonly string[], abbr: string): string[] {
  return kept.includes(abbr) ? [...kept] : [...kept, abbr];
}

/**
 * Labels to draw. The currently selected state goes last, so its label is
 * drawn on top of any overlapping neighbors.
 */
export function learnMapLabels(keepNames: boolean, kept: readonly string[], selected: string | null): string[] {
  if (!keepNames) return selected ? [selected] : [];
  const rest = kept.filter((s) => s !== selected);
  return selected ? [...rest, selected] : rest;
}

/** What the kept list becomes when the toggle changes: ON starts from the current state, OFF clears it. */
export function keptAfterToggle(on: boolean, selected: string | null): string[] {
  return on && selected ? [selected] : [];
}
