export type ActionId = 'gap-slash' | 'stop-word';
export type TargetId = 'enemy-body' | 'enemy-intent';

export interface BattleState {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  actionPoints: number;
  wordCharges: number;
  enemyIntentCancelled: boolean;
  enemyGap: number;
  message: string;
}

export type BattleEvent =
  | { type: 'playerAttack'; targetId: 'enemy-body'; damage: number }
  | { type: 'gapAdded'; targetId: 'enemy-body'; amount: number }
  | { type: 'intentCancelled'; targetId: 'enemy-intent' }
  | { type: 'resetScene' };

export interface ActionResult {
  state: BattleState;
  events: BattleEvent[];
}
