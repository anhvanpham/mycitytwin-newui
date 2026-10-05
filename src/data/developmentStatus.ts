import type { DevelopmentStatus } from './model';
/** Shared wording and colours for badges, scene geometry, pins and legends. */
export const DEVELOPMENT_STATUS = {
 APPROVED: { key: 'approved', label: 'Approved', ink: '#1c6049', soft: '#e5f3ec', map: '#b1ddce', pin: '#87bfb3' },
 'UNDER CONSTRUCTION': { key: 'construction', label: 'Under construction', ink: '#805515', soft: '#fff0cc', map: '#efd297', pin: '#c39849' },
 APPLIED: { key: 'applied', label: 'Applied', ink: '#60577b', soft: '#eeebf5', map: '#cfcee3', pin: '#a29abd' },
} as const satisfies Record<DevelopmentStatus, {key:string;label:string;ink:string;soft:string;map:string;pin:string}>;
export const DEVELOPMENT_LEGEND = [DEVELOPMENT_STATUS.APPROVED, DEVELOPMENT_STATUS['UNDER CONSTRUCTION']];
