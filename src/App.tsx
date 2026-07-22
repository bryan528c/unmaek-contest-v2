import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { gameBridge, type GameAnchor } from './bridge/GameBridge';
import { createInitialBattleState, resolveAction } from './core/battleEngine';
import type { ActionId, BattleState, TargetId } from './core/types';
import { PhaserStage } from './phaser/PhaserStage';
import { DragItem } from './ui/DragItem';
import {
  findDropTarget,
  getActionPreview,
  getExpectedTargetKind,
} from './ui/dragTargeting';

interface DragState {
  readonly actionId: ActionId;
  readonly kind: 'card' | 'word';
  readonly label: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly pointerId: number;
}

function subscribeBridgeStatus(onStoreChange: () => void): () => void {
  return gameBridge.subscribeStatus(onStoreChange);
}

function getBridgeStatusSnapshot() {
  return gameBridge.getSnapshot();
}

function isTargetId(id: string): id is TargetId {
  switch (id) {
    case 'enemy-body':
    case 'enemy-intent':
      return true;
    default:
      return false;
  }
}

export function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [battle, setBattle] = useState(createInitialBattleState);
  const battleRef = useRef<BattleState>(battle);
  const [anchors, setAnchors] = useState<readonly GameAnchor[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<GameAnchor | null>(null);
  const bridgeStatus = useSyncExternalStore(
    subscribeBridgeStatus,
    getBridgeStatusSnapshot,
    getBridgeStatusSnapshot,
  );
  const inputLocked = bridgeStatus.busy || !bridgeStatus.sceneReady;

  useEffect(() => gameBridge.subscribeAnchors(setAnchors), []);

  useEffect(() => {
    if (!inputLocked) {
      return;
    }

    setDrag(null);
    setHoveredTarget(null);
  }, [inputLocked]);

  useEffect(() => {
    if (!bridgeStatus.sceneReady || bridgeStatus.busy) {
      return;
    }

    gameBridge.sendSceneCommand({ type: 'resetScene', state: battleRef.current });
  }, [bridgeStatus.busy, bridgeStatus.sceneReady, bridgeStatus.sceneVersion]);

  function bridgeAllowsInput(): boolean {
    const currentStatus = gameBridge.getSnapshot();
    return currentStatus.sceneReady && !currentStatus.busy;
  }

  function targetAtPointer(
    actionId: ActionId,
    clientX: number,
    clientY: number,
    cancelled = false,
  ): GameAnchor | null {
    const bounds = shellRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }

    return findDropTarget({ actionId, clientX, clientY, anchors, bounds, cancelled });
  }

  function updateHoveredTarget(nextDrag: DragState): void {
    setHoveredTarget(targetAtPointer(nextDrag.actionId, nextDrag.clientX, nextDrag.clientY));
  }

  function clearDrag(): void {
    setDrag(null);
    setHoveredTarget(null);
  }

  function commitBattle(nextState: BattleState): void {
    battleRef.current = nextState;
    setBattle(nextState);
  }

  function updateBattleMessage(message: string): void {
    setBattle((current) => {
      const nextState = { ...current, message };
      battleRef.current = nextState;
      return nextState;
    });
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    actionId: ActionId,
    kind: DragState['kind'],
    label: string,
  ): void {
    if (!shellRef.current || !bridgeAllowsInput()) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const shellRect = shellRef.current.getBoundingClientRect();
    const sourceRect = event.currentTarget.getBoundingClientRect();
    const nextDrag: DragState = {
      actionId,
      kind,
      label,
      clientX: event.clientX,
      clientY: event.clientY,
      sourceX: sourceRect.left + sourceRect.width / 2 - shellRect.left,
      sourceY: sourceRect.top + sourceRect.height / 2 - shellRect.top,
      pointerId: event.pointerId,
    };

    setDrag(nextDrag);
    updateHoveredTarget(nextDrag);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    if (!bridgeAllowsInput()) {
      clearDrag();
      return;
    }

    const nextDrag = { ...drag, clientX: event.clientX, clientY: event.clientY };
    setDrag(nextDrag);
    updateHoveredTarget(nextDrag);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean): void {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const finalTarget = targetAtPointer(
      drag.actionId,
      event.clientX,
      event.clientY,
      cancelled,
    );
    clearDrag();

    if (cancelled || !bridgeAllowsInput()) {
      return;
    }

    if (!finalTarget || !isTargetId(finalTarget.id)) {
      updateBattleMessage('유효한 대상 위에 놓아 주세요.');
      return;
    }

    void gameBridge.enqueueBattleAction(() => {
      const result = resolveAction(battleRef.current, drag.actionId, finalTarget.id);
      return {
        events: result.events,
        commit: () => commitBattle(result.state),
        onFailure: () => {
          gameBridge.sendSceneCommand({ type: 'resetScene', state: battleRef.current });
        },
      };
    });
  }

  function resetProof(): void {
    if (!bridgeAllowsInput()) {
      return;
    }

    const initialState = createInitialBattleState();
    if (!gameBridge.sendSceneCommand({ type: 'resetScene', state: initialState })) {
      return;
    }

    clearDrag();
    commitBattle(initialState);
  }

  const shellRect = shellRef.current?.getBoundingClientRect();
  const pointerInShell = drag && shellRect
    ? { x: drag.clientX - shellRect.left, y: drag.clientY - shellRect.top }
    : null;
  const dragPreview = drag ? getActionPreview(drag.actionId) : null;

  return (
    <main className="page-shell">
      <header className="proof-header">
        <div>
          <p className="eyebrow">TECH PROOF 01</p>
          <h1>언맥: 잇는 자</h1>
        </div>
        <div className="proof-goal">React 드래그 ↔ Phaser 전투 장면 연결 검증</div>
      </header>

      <div
        ref={shellRef}
        className={`game-shell ${drag?.kind === 'word' ? 'word-mode' : ''} ${bridgeStatus.busy ? 'is-busy' : ''} ${bridgeStatus.sceneReady ? '' : 'scene-unready'}`}
        aria-busy={inputLocked}
        onPointerMove={moveDrag}
        onPointerUp={(event) => finishDrag(event, false)}
        onPointerCancel={(event) => finishDrag(event, true)}
      >
        <PhaserStage />

        <div className="screen-vignette" />

        <section className="top-hud">
          <div>
            <span className="location">무너진 기록실 입구</span>
            <span className="stage-count">1 / 3</span>
          </div>
          <button
            className="reset-button"
            type="button"
            disabled={inputLocked}
            onClick={resetProof}
          >
            검증 초기화
          </button>
        </section>

        <section className="actor-hud player-hud">
          <strong>기록 복원사</strong>
          <div className="health-track">
            <div
              className="health-fill player-health"
              style={{ width: `${(battle.playerHp / battle.playerMaxHp) * 100}%` }}
            />
          </div>
          <span>{battle.playerHp} / {battle.playerMaxHp}</span>
        </section>

        <section className="actor-hud enemy-hud">
          <strong>돌짐승</strong>
          <div className="health-track">
            <div
              className="health-fill enemy-health"
              style={{ width: `${(battle.enemyHp / battle.enemyMaxHp) * 100}%` }}
            />
          </div>
          <span>{battle.enemyHp} / {battle.enemyMaxHp}</span>
          {battle.enemyGap > 0 && <em className="gap-label">틈 {battle.enemyGap}</em>}
        </section>

        {drag && anchors.map((anchor) => {
          const valid = anchor.kind === getExpectedTargetKind(drag.actionId);
          return (
            <div
              key={anchor.id}
              className={`target-ring ${valid ? 'valid' : 'invalid'} ${hoveredTarget?.id === anchor.id ? 'hovered' : ''}`}
              style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
            >
              {valid && <span>{anchor.label}</span>}
            </div>
          );
        })}

        {drag && pointerInShell && (
          <svg className="drag-thread" viewBox={`0 0 ${shellRect?.width ?? 1280} ${shellRect?.height ?? 720}`}>
            <line
              x1={drag.sourceX}
              y1={drag.sourceY}
              x2={pointerInShell.x}
              y2={pointerInShell.y}
              className={drag.kind === 'word' ? 'word-thread' : 'action-thread'}
            />
          </svg>
        )}

        {drag && pointerInShell && (
          <div
            className={`drag-ghost ${drag.kind}`}
            style={{ left: pointerInShell.x, top: pointerInShell.y }}
          >
            {drag.kind === 'word' ? drag.label : '／'}
          </div>
        )}

        {hoveredTarget && dragPreview && (
          <div
            className="target-preview"
            style={{ left: `${hoveredTarget.x * 100}%`, top: `${hoveredTarget.y * 100}%` }}
          >
            <strong>{dragPreview.title}</strong>
            <span>{dragPreview.detail}</span>
          </div>
        )}

        <section className="bottom-overlay">
          <aside className="word-zone">
            <div className="resource-label">언령 {battle.wordCharges} / 2</div>
            <DragItem
              className="word-slot active"
              disabled={inputLocked || battle.wordCharges < 1 || battle.enemyIntentCancelled}
              onPointerDown={(event) => beginDrag(event, 'stop-word', 'word', '멎는다.')}
            >
              <span>멎는다.</span>
              <small>행동을 중단한다</small>
            </DragItem>
            <div className="word-slot locked"><span>되돌린다.</span><small>다음 검증</small></div>
          </aside>

          <section className="hand-zone">
            <div className="resource-label">행동력 {battle.actionPoints} / 3</div>
            <DragItem
              className="skill-card active"
              disabled={inputLocked || battle.actionPoints < 1 || battle.enemyHp <= 0}
              onPointerDown={(event) => beginDrag(event, 'gap-slash', 'card', '틈새 베기')}
            >
              <span className="cost">1</span>
              <span className="card-art">／</span>
              <strong>틈새 베기</strong>
              <small>피해 6 · 틈 +1</small>
            </DragItem>
            <div className="skill-card placeholder"><span className="cost">1</span><strong>흘려내기</strong><small>다음 검증</small></div>
            <div className="skill-card placeholder"><span className="cost">0</span><strong>숨 고르기</strong><small>다음 검증</small></div>
          </section>

          <aside className="proof-status" aria-live="polite">
            <span>현재 결과</span>
            <strong>{battle.message}</strong>
          </aside>
        </section>
      </div>

      <section className="checklist">
        <h2>이번 검증의 통과 기준</h2>
        <ol>
          <li>일반 카드가 Phaser 적 몸에 정확히 스냅되는가</li>
          <li>공격·피격·틈 연출이 순서대로 보이는가</li>
          <li>언령 드래그가 일반 카드와 전혀 다르게 느껴지는가</li>
          <li>멎는다가 적 행동 앵커에만 적용되는가</li>
          <li>1280×720 및 축소 화면에서도 좌표가 어긋나지 않는가</li>
        </ol>
      </section>
    </main>
  );
}
