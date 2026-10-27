import { describe, expect, it } from 'vitest';
import { isInHoddleGrid } from './hoddleGridMap';

describe('Hoddle Grid project map', () => {
  it('keeps the central grid inside the four boundary streets', () => {
    expect(isInHoddleGrid([144.9631, -37.8136])).toBe(true);
    expect(isInHoddleGrid([144.9630, -37.8105])).toBe(true);
    expect(isInHoddleGrid([144.9671, -37.8174])).toBe(true);
  });
  it('excludes the fringe and rectangular-bounds corners', () => {
    // Franklin Street lies within the rectangle but north of La Trobe Street.
    expect(isInHoddleGrid([144.9584, -37.8084])).toBe(false);
    expect(isInHoddleGrid([144.9630, -37.8098])).toBe(false);
    expect(isInHoddleGrid([144.9740, -37.8190])).toBe(false);
    expect(isInHoddleGrid([144.943, -37.816])).toBe(false);
    expect(isInHoddleGrid([144.8326, -37.7880])).toBe(false);
  });
});
