import type { ActionId, ActionResult, BattleState, TargetId } from './types';

export function createInitialBattleState(): BattleState {
  return {
    playerHp: 25,
    playerMaxHp: 32,
    enemyHp: 34,
    enemyMaxHp: 40,
    actionPoints: 3,
    wordCharges: 2,
    enemyIntentCancelled: false,
    enemyGap: 0,
    message: '카드 또는 언령을 끌어서 대상에 놓아 보세요.',
  };
}

export function canUseAction(
  state: BattleState,
  actionId: ActionId,
  targetId: TargetId,
): boolean {
  if (actionId === 'gap-slash') {
    return targetId === 'enemy-body' && state.actionPoints >= 1 && state.enemyHp > 0;
  }

  return (
    targetId === 'enemy-intent' &&
    state.wordCharges >= 1 &&
    !state.enemyIntentCancelled &&
    state.enemyHp > 0
  );
}

export function resolveAction(
  state: BattleState,
  actionId: ActionId,
  targetId: TargetId,
): ActionResult {
  if (!canUseAction(state, actionId, targetId)) {
    return {
      state: { ...state, message: '지금은 그 대상에 사용할 수 없습니다.' },
      events: [],
    };
  }

  if (actionId === 'gap-slash') {
    const damage = 6;
    return {
      state: {
        ...state,
        enemyHp: Math.max(0, state.enemyHp - damage),
        actionPoints: state.actionPoints - 1,
        enemyGap: state.enemyGap + 1,
        message: `틈새 베기: 피해 ${damage}, 틈 +1`,
      },
      events: [
        { type: 'playerAttack', targetId: 'enemy-body', damage },
        { type: 'gapAdded', targetId: 'enemy-body', amount: 1 },
      ],
    };
  }

  return {
    state: {
      ...state,
      wordCharges: state.wordCharges - 1,
      enemyIntentCancelled: true,
      message: '멎는다: 내리치기가 취소되었습니다.',
    },
    events: [{ type: 'intentCancelled', targetId: 'enemy-intent' }],
  };
}
