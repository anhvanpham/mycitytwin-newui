import { describe, expect, it } from 'vitest';
import data from '../../public/data/future-cbd.json';
import { timelineForYear } from './futureTimeline';
import type { Project } from './futureCatalogue';
const projects = data.projects as Project[];
describe('published timeline', () => {
  it('shows Franklin start in 2027 without inventing later construction years', () => {
    expect(timelineForYear(projects, 2027).some(i => i.project.id === 'franklin-street')).toBe(true);
    expect(timelineForYear(projects, 2028).some(i => i.project.id === 'franklin-street')).toBe(false);
  });
  it('changes airport stages at 2028 and does not assert future completion', () => {
    const before = timelineForYear(projects, 2027).find(i => i.project.id === 'melbourne-airport-rail')!;
    const after = timelineForYear(projects, 2028).find(i => i.project.id === 'melbourne-airport-rail')!;
    expect(before.detail).not.toContain('planned start 2028');
    expect(after.detail).toContain('planned start 2028');
    expect(timelineForYear(projects, 2030).find(i => i.project.id === 'melbourne-airport-rail')?.label).toBe('Published schedule');
  });
  it('keeps unknown dates separate and records actual milestones only in their year', () => {
    expect(timelineForYear(projects, 2027).find(i => i.project.id === 'gurrowa-place')?.undated).toBe(true);
    expect(timelineForYear(projects, 2025).find(i => i.project.id === 'greenline')?.label).toBe('Recorded milestone');
    expect(timelineForYear(projects, 2027).find(i => i.project.id === 'greenline')?.undated).toBe(true);
  });
});
