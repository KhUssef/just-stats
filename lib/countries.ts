// Colour for a country: one of the seven categorical slots when the country
// is in the palette (see stats.countryPalette), the neutral tone otherwise.
export function countryColor(palette: string[], code: string | null | undefined): string {
  const slot = code ? palette.indexOf(code) : -1;
  return slot === -1 ? "var(--country-other)" : `var(--country-${slot + 1})`;
}
