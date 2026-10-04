import { describe, expect, it } from 'vitest';
import { shuffled, navigate } from './practice';

describe('practice rounds', () => {
  it('keeps every card exactly once and does not mutate the saved order', () => {
    const cards = [1, 2, 3, 4];
    const round = shuffled(cards);
    expect(round.sort()).toEqual(cards);
    expect(cards).toEqual([1, 2, 3, 4]);
    expect(round).not.toBe(cards);
  });
  it('stays at the boundaries and returns to the same previous card', () => {
    expect(navigate(0, -1, 3)).toBe(0);
    expect(navigate(0, 1, 3)).toBe(1);
    expect(navigate(1, -1, 3)).toBe(0);
    expect(navigate(2, 1, 3)).toBe(2);
    expect(navigate(0, 1, 0)).toBe(0);
  });
});
