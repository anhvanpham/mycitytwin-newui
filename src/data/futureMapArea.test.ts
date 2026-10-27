import { describe, expect, it } from 'vitest';
import { anchors, timelineForYear } from './futureTimeline';
import { projectInMapArea, projectMapBounds } from './futureMapArea';
import data from '../../public/data/future-cbd.json';
import type { Project } from './futureCatalogue';

describe('Future Plans map areas', () => {
  const items=timelineForYear(data.projects as Project[], 2027).filter(item=>!item.undated);
  it('restores several city projects while keeping the grid as an option', () => {
    const visible=(area: 'grid'|'city'|'all')=>items.filter(item=>projectInMapArea(anchors[item.project.id],area)).map(item=>item.project.id);
    expect(visible('grid')).toEqual(['central-city-urban-forest']);
    expect(visible('city')).toHaveLength(3);
    expect(visible('city')).toContain('franklin-street');
    expect(visible('city')).toContain('state-library-overstation');
    expect(visible('all')).toContain('melbourne-airport-rail');
    expect(visible('all')).toHaveLength(4);
  });
  it('fits every scheduled location, including the western rail corridor', () => {
    const points=items.map(item=>anchors[item.project.id]);
    const [sw,ne]=projectMapBounds(points);
    for(const point of points) {
      expect(point[0]).toBeGreaterThanOrEqual(sw[0]);expect(point[0]).toBeLessThanOrEqual(ne[0]);
      expect(point[1]).toBeGreaterThanOrEqual(sw[1]);expect(point[1]).toBeLessThanOrEqual(ne[1]);
    }
  });
  it('keeps empty and single-project views readable', () => {
    expect(projectMapBounds([])[0][0]).toBeLessThan(projectMapBounds([])[1][0]);
    const [sw,ne]=projectMapBounds([anchors['central-city-urban-forest']]);
    expect(ne[0]-sw[0]).toBeCloseTo(0.008);
    expect(ne[1]-sw[1]).toBeCloseTo(0.008);
  });
});
