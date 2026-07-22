import { describe, expect, it } from 'vitest';
import { canUseAction, createInitialBattleState, resolveAction } from '../src/core/battleEngine';

describe('battleEngine technical proof', () => {
  it('uses gap slash on the enemy actor and creates a gap', () => {
    const initial = createInitialBattleState();
    const result = resolveAction(initial, 'gap-slash', 'enemy-body');

    expect(result.state.enemyHp).toBe(28);
    expect(result.state.enemyGap).toBe(1);
    expect(result.state.actionPoints).toBe(2);
    expect(result.events.map((event) => event.type)).toEqual(['playerAttack', 'gapAdded']);
  });

  it('stops only the enemy intent and consumes one word charge', () => {
    const initial = createInitialBattleState();
    expect(canUseAction(initial, 'stop-word', 'enemy-body')).toBe(false);

    const result = resolveAction(initial, 'stop-word', 'enemy-intent');
    expect(result.state.enemyIntentCancelled).toBe(true);
    expect(result.state.wordCharges).toBe(1);
    expect(result.events[0]?.type).toBe('intentCancelled');
  });
});
