export type LandingFeature = 'developments' | 'sunlight' | 'solar' | 'activity' | 'inside';

export const LANDING_FEATURES: { key: LandingFeature; short: string; pin: string; title: string; body: string; image: string }[] = [
  { key: 'developments', short: 'Developments', pin: 'Developments', title: 'Developments', body: 'Find nearby projects, their status and height.', image: 'after.jpg' },
  { key: 'sunlight', short: 'Sunlight', pin: 'Sunlight', title: 'Sunlight & shadows', body: 'Compare shadows by date, time and season.', image: 'sun.jpg' },
  { key: 'solar', short: 'Solar', pin: 'Rooftop solar', title: 'Rooftop solar', body: 'Estimate panel output and building shade.', image: 'today.jpg' },
  { key: 'activity', short: 'Street activity', pin: 'Street activity', title: 'Street activity', body: 'Explore hourly pedestrian forecasts at mapped sensors.', image: 'find.jpg' },
  { key: 'inside', short: 'Inside views', pin: 'Window sunlight', title: 'Views from inside', body: 'Choose a floor and facing direction to check window sunlight.', image: 'today.jpg' },
];

/** Shared architectural symbols for the landing navigation and feature cards. */
export function LandingFeatureIcon({ feature }: { feature: LandingFeature }) {
  const paths: Record<LandingFeature, React.ReactNode> = {
    developments: <><path d="M2 22h24M5 22V11l5-3v14M12 22V5l5-3 5 3v17M24 22V12l-2-1M17 7v11" /></>,
    sunlight: <><circle cx="14" cy="14" r="5" /><path d="M14 1v4M14 23v4M1 14h4M23 14h4M5 5l3 3M20 20l3 3M5 23l3-3M20 8l3-3" /></>,
    solar: <><path d="M5 5h18l3 14H2L5 5ZM5 12h18M11 5 9 19M17 5l2 14M14 19v6M8 25h12" /></>,
    activity: <><circle cx="14" cy="6" r="3" /><circle cx="5" cy="9" r="2.5" /><circle cx="23" cy="9" r="2.5" /><path d="M8 25v-7c0-7 12-7 12 0v7M1 24v-7c0-4 4-5 7-3M27 24v-7c0-4-4-5-7-3M13 21v5M16 21v5" /></>,
    inside: <><path d="M5 3h18v23H5V3ZM14 3v23M5 14h18M9 7v3M18 18v3" /></>,
  };
  return <svg className="landing-feature-icon" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[feature]}</svg>;
}
