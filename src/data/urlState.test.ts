import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseSubject, readUrlState, writeUrlState } from './urlState';

/*
 * A link names one place. Two at once was reachable by hand-editing the
 * query string, and it did not fail loudly: the building took over the
 * panels, the camera and the measurement while the 3D view kept drawing the
 * development — so the sunlight screen, whose entire claim is that you are
 * looking at one building's shadow, showed a different building's.
 */
describe('choosing the subject a URL names', () => {
  it('leaves a URL that names only one thing alone', () => {
    expect(chooseSubject('explore', 'X0015809', null)).toEqual({
      devKey: 'X0015809',
      buildingId: null,
    });
    expect(chooseSubject('explore', null, 'abc')).toEqual({
      devKey: null,
      buildingId: 'abc',
    });
    expect(chooseSubject('landing', null, null)).toEqual({
      devKey: null,
      buildingId: null,
    });
  });

  it('lets the project page keep its project', () => {
    expect(chooseSubject('development', 'X0015809', 'abc')).toEqual({
      devKey: 'X0015809',
      buildingId: null,
    });
  });

  it('lets the building page keep its building', () => {
    expect(chooseSubject('building', 'X0015809', 'abc')).toEqual({
      devKey: null,
      buildingId: 'abc',
    });
  });

  it('never returns both, on any view', () => {
    const views = ['landing', 'explore', 'development', 'building', 'sunlight'] as const;
    for (const view of views) {
      const chosen = chooseSubject(view, 'X0015809', 'abc');
      expect(Boolean(chosen.devKey && chosen.buildingId)).toBe(false);
      // And it never drops both — the link still names something.
      expect(Boolean(chosen.devKey || chosen.buildingId)).toBe(true);
    }
  });
});


afterEach(() => vi.unstubAllGlobals());

describe('shared landmark locations', () => {
  it('reopens a landmark without retaining a previously selected model subject', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/ver-4/', search: '?view=explore&landmark=48&dev=old&bldg=old', hash: '' }, history: { replaceState } });
    const state = readUrlState();
    expect(state.landmarkId).toBe('48');
    expect(state.devKey).toBeNull();
    expect(state.buildingId).toBeNull();
    writeUrlState(state);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/ver-4/?view=explore&landmark=48');
  });

  it('ignores an unknown landmark and keeps a valid subject link', () => {
    vi.stubGlobal('window', { location: { search: '?view=building&landmark=unknown&bldg=valid-building' } });
    const state = readUrlState();
    expect(state.landmarkId).toBeNull();
    expect(state.buildingId).toBe('valid-building');
  });

  it('removes the landmark when the selection is cleared', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/', search: '?view=explore&landmark=48', hash: '' }, history: { replaceState } });
    const state = readUrlState();
    writeUrlState({ ...state, landmarkId: null });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?view=explore');
  });
});
