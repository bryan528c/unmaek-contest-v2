import { describe, expect, it, vi } from 'vitest';
import { GameBridge, type SceneCommand } from '../src/bridge/GameBridge';
import { createInitialBattleState } from '../src/core/battleEngine';
import type { BattleEvent } from '../src/core/types';

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

function attackEvent(damage: number): BattleEvent {
  return { type: 'playerAttack', targetId: 'enemy-body', damage };
}

function noOpCommand(_command: SceneCommand): void {
  // The queue tests do not need scene-command presentation.
}

describe('GameBridge', () => {
  it('tracks scene readiness and leaves only the newest token consumer registered', async () => {
    const bridge = new GameBridge();
    const firstCalls: number[] = [];
    const secondCalls: number[] = [];

    expect(bridge.getSnapshot()).toEqual({
      sceneReady: false,
      busy: false,
      sceneVersion: 0,
    });

    const disposeFirst = bridge.registerSceneConsumer({
      playBattleEvents: async (events) => {
        firstCalls.push(events.length);
      },
      handleSceneCommand: noOpCommand,
    });
    expect(bridge.getSnapshot().sceneVersion).toBe(1);

    const disposeSecond = bridge.registerSceneConsumer({
      playBattleEvents: async (events) => {
        secondCalls.push(events.length);
      },
      handleSceneCommand: noOpCommand,
    });
    expect(bridge.getSnapshot()).toMatchObject({ sceneReady: true, sceneVersion: 2 });

    disposeFirst();
    expect(bridge.getSnapshot()).toMatchObject({ sceneReady: true, sceneVersion: 2 });
    await expect(bridge.enqueueBattleEvents([attackEvent(1)])).resolves.toBe(true);
    expect(firstCalls).toEqual([]);
    expect(secondCalls).toEqual([1]);

    disposeSecond();
    expect(bridge.getSnapshot()).toEqual({
      sceneReady: false,
      busy: false,
      sceneVersion: 3,
    });
  });

  it('plays multiple event batches in FIFO order', async () => {
    const bridge = new GameBridge();
    const timeline: string[] = [];
    const gates: Deferred[] = [];

    bridge.registerSceneConsumer({
      playBattleEvents: async (events) => {
        const event = events[0];
        if (event?.type !== 'playerAttack') throw new Error('Expected an attack event.');
        timeline.push(`start-${event.damage}`);
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        timeline.push(`end-${event.damage}`);
      },
      handleSceneCommand: noOpCommand,
    });

    const first = bridge.enqueueBattleEvents([attackEvent(1)]);
    const second = bridge.enqueueBattleEvents([attackEvent(2)]);
    const third = bridge.enqueueBattleEvents([attackEvent(3)]);

    expect(timeline).toEqual(['start-1']);
    gates[0]?.resolve();
    await expect(first).resolves.toBe(true);
    expect(timeline).toEqual(['start-1', 'end-1', 'start-2']);

    gates[1]?.resolve();
    await expect(second).resolves.toBe(true);
    expect(timeline).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3']);

    gates[2]?.resolve();
    await expect(third).resolves.toBe(true);
    expect(timeline).toEqual([
      'start-1',
      'end-1',
      'start-2',
      'end-2',
      'start-3',
      'end-3',
    ]);
  });

  it('never runs two batch players at the same time', async () => {
    const bridge = new GameBridge();
    const gates: Deferred[] = [];
    let activePlayers = 0;
    let maximumActivePlayers = 0;

    bridge.registerSceneConsumer({
      playBattleEvents: async () => {
        activePlayers += 1;
        maximumActivePlayers = Math.max(maximumActivePlayers, activePlayers);
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        activePlayers -= 1;
      },
      handleSceneCommand: noOpCommand,
    });

    const first = bridge.enqueueBattleEvents([attackEvent(1)]);
    const second = bridge.enqueueBattleEvents([attackEvent(2)]);

    expect(activePlayers).toBe(1);
    gates[0]?.resolve();
    await first;
    expect(activePlayers).toBe(1);
    gates[1]?.resolve();
    await second;

    expect(maximumActivePlayers).toBe(1);
    expect(activePlayers).toBe(0);
  });

  it('sets busy immediately and clears it only after the complete queue', async () => {
    const bridge = new GameBridge();
    const gates: Deferred[] = [];

    bridge.registerSceneConsumer({
      playBattleEvents: async () => {
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
      },
      handleSceneCommand: noOpCommand,
    });

    const first = bridge.enqueueBattleEvents([attackEvent(1)]);
    expect(bridge.getSnapshot().busy).toBe(true);
    const second = bridge.enqueueBattleEvents([attackEvent(2)]);

    gates[0]?.resolve();
    await first;
    expect(bridge.getSnapshot().busy).toBe(true);

    gates[1]?.resolve();
    await second;
    expect(bridge.getSnapshot().busy).toBe(false);
  });

  it('rejects input without a ready scene, including reentrant removal during locking', async () => {
    const bridge = new GameBridge();
    const factory = vi.fn(() => ({
      events: [attackEvent(1)] as const,
      commit: vi.fn(),
    }));

    await expect(bridge.enqueueBattleEvents([attackEvent(1)])).resolves.toBe(false);
    await expect(bridge.enqueueBattleAction(factory)).resolves.toBe(false);
    expect(factory).not.toHaveBeenCalled();
    expect(bridge.getSnapshot()).toMatchObject({ sceneReady: false, busy: false });

    const reentrantBridge = new GameBridge();
    const reentrantFactory = vi.fn(() => ({
      events: [attackEvent(2)] as const,
      commit: vi.fn(),
    }));
    const dispose = reentrantBridge.registerSceneConsumer({
      playBattleEvents: async () => undefined,
      handleSceneCommand: noOpCommand,
    });
    const unsubscribeStatus = reentrantBridge.subscribeStatus(() => {
      if (reentrantBridge.getSnapshot().busy) dispose();
    });

    await expect(reentrantBridge.enqueueBattleAction(reentrantFactory)).resolves.toBe(false);
    expect(reentrantFactory).not.toHaveBeenCalled();
    expect(reentrantBridge.getSnapshot()).toMatchObject({ sceneReady: false, busy: false });
    unsubscribeStatus();
  });

  it('ignores empty event batches without locking or calling the player', async () => {
    const bridge = new GameBridge();
    const playBattleEvents = vi.fn(async () => undefined);
    const commit = vi.fn();

    bridge.registerSceneConsumer({ playBattleEvents, handleSceneCommand: noOpCommand });

    await expect(bridge.enqueueBattleEvents([])).resolves.toBe(false);
    await expect(bridge.enqueueBattleAction(() => ({ events: [], commit }))).resolves.toBe(false);

    expect(playBattleEvents).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(bridge.getSnapshot().busy).toBe(false);
  });

  it('clears the waiting queue and busy lock after playback fails', async () => {
    const bridge = new GameBridge();
    const playbackError = new Error('animation failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldFail = true;
    const playedDamage: number[] = [];

    bridge.registerSceneConsumer({
      playBattleEvents: async (events) => {
        const event = events[0];
        if (event?.type !== 'playerAttack') throw new Error('Expected an attack event.');
        playedDamage.push(event.damage);
        if (shouldFail) throw playbackError;
      },
      handleSceneCommand: noOpCommand,
    });

    const failure = vi.fn();
    const first = bridge.enqueueBattleAction(() => ({
      events: [attackEvent(1)],
      commit: vi.fn(),
      onFailure: failure,
    }));
    const waiting = bridge.enqueueBattleEvents([attackEvent(2)]);

    await expect(first).resolves.toBe(false);
    await expect(waiting).resolves.toBe(false);
    expect(playedDamage).toEqual([1]);
    expect(failure).toHaveBeenCalledOnce();
    expect(failure).toHaveBeenCalledWith(playbackError);
    expect(bridge.getSnapshot().busy).toBe(false);

    shouldFail = false;
    await expect(bridge.enqueueBattleEvents([attackEvent(3)])).resolves.toBe(true);
    expect(playedDamage).toEqual([1, 3]);
    consoleError.mockRestore();
  });

  it('aborts the active player and consumes no queued work after unregistering', async () => {
    const bridge = new GameBridge();
    const signals: AbortSignal[] = [];
    let playerCalls = 0;

    const dispose = bridge.registerSceneConsumer({
      playBattleEvents: (_events, signal) => {
        playerCalls += 1;
        signals.push(signal);
        return new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      },
      handleSceneCommand: noOpCommand,
    });

    const active = bridge.enqueueBattleEvents([attackEvent(1)]);
    const waiting = bridge.enqueueBattleEvents([attackEvent(2)]);
    dispose();

    expect(signals[0]?.aborted).toBe(true);
    await expect(active).resolves.toBe(false);
    await expect(waiting).resolves.toBe(false);
    await expect(bridge.enqueueBattleEvents([attackEvent(3)])).resolves.toBe(false);
    expect(playerCalls).toBe(1);
    expect(bridge.getSnapshot()).toMatchObject({ sceneReady: false, busy: false });
  });

  it('locks before resolving and commits an action exactly once after playback', async () => {
    const bridge = new GameBridge();
    const playback = deferred();
    const timeline: string[] = [];
    const commit = vi.fn(() => timeline.push('commit'));

    bridge.registerSceneConsumer({
      playBattleEvents: async () => {
        timeline.push('play');
        await playback.promise;
      },
      handleSceneCommand: noOpCommand,
    });

    const completion = bridge.enqueueBattleAction(() => {
      expect(bridge.getSnapshot().busy).toBe(true);
      timeline.push('resolve');
      return { events: [attackEvent(6)], commit };
    });

    expect(bridge.getSnapshot().busy).toBe(true);
    expect(timeline).toEqual(['resolve', 'play']);
    expect(commit).not.toHaveBeenCalled();

    playback.resolve();
    await expect(completion).resolves.toBe(true);
    expect(timeline).toEqual(['resolve', 'play', 'commit']);
    expect(commit).toHaveBeenCalledOnce();
    expect(bridge.getSnapshot().busy).toBe(false);
  });

  it('keeps scene commands separate and recovers without committing a failed action', async () => {
    const bridge = new GameBridge();
    const playbackError = new Error('presentation failed');
    const commands: SceneCommand[] = [];
    const confirmedState = createInitialBattleState();
    const commit = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    bridge.registerSceneConsumer({
      playBattleEvents: async () => {
        throw playbackError;
      },
      handleSceneCommand: (command) => commands.push(command),
    });

    const completion = bridge.enqueueBattleAction(() => ({
      events: [attackEvent(6)],
      commit,
      onFailure: () => {
        bridge.sendSceneCommand({ type: 'resetScene', state: confirmedState });
      },
    }));

    await expect(completion).resolves.toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(commands).toEqual([{ type: 'resetScene', state: confirmedState }]);
    expect(bridge.getSnapshot().busy).toBe(false);
    consoleError.mockRestore();
  });
});
