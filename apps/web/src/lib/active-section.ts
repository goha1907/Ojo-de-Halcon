export interface SectionBounds {
  id: string;
  top: number;
  bottom: number;
}

/**
 * The section being read: the last one (in page order) whose top has passed `line`. It stays active until
 * the next one starts, so the gap between two menu sections does not blank the menu. Once the last section
 * is entirely above the line, nothing is active (the page has moved on to the closing blocks).
 */
export function pickActiveSection(sections: readonly SectionBounds[], line: number): string | null {
  let active: string | null = null;
  sections.forEach((section, index) => {
    if (section.top > line) return;
    const isLast = index === sections.length - 1;
    active = isLast && section.bottom <= line ? null : section.id;
  });
  return active;
}
