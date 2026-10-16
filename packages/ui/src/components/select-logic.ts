export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Index of the nearest enabled option from `from` in the direction of `step`; stays on `from` at the edge. */
export function nextEnabledIndex(options: readonly SelectOption[], from: number, step: 1 | -1): number {
  for (let index = from + step; index >= 0 && index < options.length; index += step) {
    if (!options[index]!.disabled) return index;
  }
  return from;
}

export function firstEnabledIndex(options: readonly SelectOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

export function lastEnabledIndex(options: readonly SelectOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]!.disabled) return index;
  }
  return -1;
}

/**
 * Type-ahead: the next enabled option (after `from`, wrapping around) whose label starts with `query`,
 * ignoring case; -1 when none does. Typing the same letter again walks through the options of that letter.
 */
export function matchPrefix(options: readonly SelectOption[], query: string, from: number): number {
  const needle = query.toLocaleLowerCase();
  if (needle === "") return -1;
  for (let step = 1; step <= options.length; step += 1) {
    const index = (from + step + options.length) % options.length;
    const option = options[index]!;
    if (!option.disabled && option.label.toLocaleLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
