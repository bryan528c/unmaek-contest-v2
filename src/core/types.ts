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
  | {
      readonly type: 'playerAttack';
      readonly targetId: 'enemy-body';
      readonly damage: number;
    }
  | {
      readonly type: 'gapAdded';
      readonly targetId: 'enemy-body';
      readonly amount: number;
    }
  | {
      readonly type: 'intentCancelled';
      readonly targetId: 'enemy-intent';
    };

export interface ActionResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}
