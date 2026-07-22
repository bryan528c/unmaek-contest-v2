import { describe, expect, it } from 'vitest';
import { canUseAction, createInitialBattleState, resolveAction } from '../src/core/battleEngine';
import type { ActionId } from '../src/core/types';

describe('battleEngine technical proof', () => {
  it('applies gap slash damage, cost, and gap exactly once', () => {
    const initial = createInitialBattleState();
    const result = resolveAction(initial, 'gap-slash', 'enemy-body');

    expect(result.state.enemyHp).toBe(28);
    expect(result.state.enemyGap).toBe(1);
    expect(result.state.actionPoints).toBe(2);
    expect(result.events).toEqual([
      { type: 'playerAttack', targetId: 'enemy-body', damage: 6 },
      { type: 'gapAdded', targetId: 'enemy-body', amount: 1 },
    ]);
  });

  it('cancels the enemy intent and consumes one word charge exactly once', () => {
    const initial = createInitialBattleState();
    const result = resolveAction(initial, 'stop-word', 'enemy-intent');

    expect(result.state.enemyIntentCancelled).toBe(true);
    expect(result.state.wordCharges).toBe(1);
    expect(result.events).toEqual([
      { type: 'intentCancelled', targetId: 'enemy-intent' },
    ]);
  });

  it('rejects an action dropped on the wrong target without consuming resources', () => {
    const initial = createInitialBattleState();
    const result = resolveAction(initial, 'stop-word', 'enemy-body');

    expect(result.state.wordCharges).toBe(initial.wordCharges);
    expect(result.state.enemyIntentCancelled).toBe(false);
    expect(result.events).toEqual([]);
  });

  it('does not allow stop word to be applied twice', () => {
    const initial = createInitialBattleState();
    const firstResult = resolveAction(initial, 'stop-word', 'enemy-intent');
    const secondResult = resolveAction(firstResult.state, 'stop-word', 'enemy-intent');

    expect(secondResult.state.wordCharges).toBe(1);
    expect(secondResult.state.enemyIntentCancelled).toBe(true);
    expect(secondResult.events).toEqual([]);
  });

  it('does not mutate the confirmed battle state while resolving an action', () => {
    const initial = createInitialBattleState();

    resolveAction(initial, 'gap-slash', 'enemy-body');

    expect(initial.enemyHp).toBe(34);
    expect(initial.enemyGap).toBe(0);
    expect(initial.actionPoints).toBe(3);
  });

  it('throws for an unknown action ID instead of treating it as another action', () => {
    const initial = createInitialBattleState();
    const unknownAction = 'unknown-action' as ActionId;

    expect(() => canUseAction(initial, unknownAction, 'enemy-intent')).toThrow(
      'Unsupported action ID: unknown-action',
    );
    expect(() => resolveAction(initial, unknownAction, 'enemy-intent')).toThrow(
      'Unsupported action ID: unknown-action',
    );
  });
});
