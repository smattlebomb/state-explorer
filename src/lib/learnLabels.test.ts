import { describe, expect, it } from 'vitest';
import { keepLabel, keptAfterToggle, learnMapLabels } from './learnLabels';

describe('Learn keep-names labels', () => {
  it('OFF: only the last-tapped state is labeled (current behavior)', () => {
    expect(learnMapLabels(false, ['TX', 'OK'], 'OH')).toEqual(['OH']);
    expect(learnMapLabels(false, ['TX'], null)).toEqual([]);
  });

  it('ON: labels build up, with the selected state drawn last (on top)', () => {
    let kept: string[] = [];
    for (const s of ['TX', 'OK', 'NM']) kept = keepLabel(kept, s);
    expect(learnMapLabels(true, kept, 'NM')).toEqual(['TX', 'OK', 'NM']);
    // Re-tapping an earlier state doesn't duplicate it, and moves it on top.
    kept = keepLabel(kept, 'TX');
    expect(kept).toEqual(['TX', 'OK', 'NM']);
    expect(learnMapLabels(true, kept, 'TX')).toEqual(['OK', 'NM', 'TX']);
  });

  it('ON with nothing selected shows the kept names', () => {
    expect(learnMapLabels(true, ['RI', 'CT'], null)).toEqual(['RI', 'CT']);
  });

  it('after "Clear names", only the current state keeps its label', () => {
    expect(learnMapLabels(true, [], 'OH')).toEqual(['OH']);
  });

  it('toggling ON starts from the current state; OFF clears the list', () => {
    expect(keptAfterToggle(true, 'OH')).toEqual(['OH']);
    expect(keptAfterToggle(true, null)).toEqual([]);
    expect(keptAfterToggle(false, 'OH')).toEqual([]);
  });

  it('keepLabel does not mutate its input', () => {
    const kept = ['TX'];
    keepLabel(kept, 'OK');
    expect(kept).toEqual(['TX']);
  });
});
