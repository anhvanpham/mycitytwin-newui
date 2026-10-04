/** Illustrative dimensions, not a surveyed height model or an allometric equation. */
export function treeDimensions(diameterCm: number | null, species: string) {
  const diameter = diameterCm !== null && Number.isFinite(diameterCm) && diameterCm > 0 ? diameterCm : 30;
  const palm = /palm/i.test(species);
  const heightM = Math.round(Math.min(22, Math.max(4, 4 + Math.sqrt(diameter) * 1.6)) * 10) / 10;
  return {
    heightM,
    trunkRadiusM: Math.min(0.65, Math.max(0.1, diameter / 200)),
    crownRadiusM: palm ? 2 : Math.min(4.8, Math.max(1.4, heightM * 0.25)),
    crownHeightM: heightM * (palm ? 0.2 : 0.57),
  };
}
/** Gradual dusk/dawn switching based on solar altitude, including date and DST. */
export function streetlightPower(altitudeDeg: number) {
  if (!Number.isFinite(altitudeDeg)) return 0;
  const dusk = Math.min(1, Math.max(0, (1 - altitudeDeg) / 6));
  return dusk * dusk * (3 - 2 * dusk);
}
export const STREETLAMP_HEIGHT_M = 8; // Illustration: the pole records contain no height.
