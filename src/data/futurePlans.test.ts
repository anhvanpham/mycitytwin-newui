import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendPlanQuestion } from './futurePlans';
import { readUrlState, writeUrlState, type UrlState } from './urlState';

afterEach(() => vi.unstubAllGlobals());

describe('guided plan conversations', () => {
  it('keeps earlier questions in order and revisits without duplicating an exchange', () => {
    const first = appendPlanQuestion([], 'shade');
    const second = appendPlanQuestion(first, 'access');
    expect(second).toEqual(['shade', 'access']);
    expect(appendPlanQuestion(second, 'shade')).toBe(second);
    expect(first).toEqual(['shade']);
  });

  it('opens the Future Plans page from a shared URL and preserves its route on write', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/', search: '?view=future', hash: '' }, history: { replaceState } });
    const state = readUrlState(new Date('2026-10-04T01:00:00Z'));
    expect(state.view).toBe('future');
    vi.stubGlobal('window', { location: { pathname: '/', search: '', hash: '' }, history: { replaceState } });
    writeUrlState(state as UrlState);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?view=future');
  });
});
