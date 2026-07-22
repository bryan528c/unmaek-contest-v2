import type { BattleEvent, BattleState } from '../core/types';

export type AnchorKind = 'actor' | 'intent';

export interface GameAnchor {
  readonly id: 'enemy-body' | 'enemy-intent';
  readonly kind: AnchorKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly label: string;
}

export interface BridgeSnapshot {
  readonly sceneReady: boolean;
  readonly busy: boolean;
  readonly sceneVersion: number;
}

export type SceneCommand = {
  readonly type: 'resetScene';
  readonly state: BattleState;
};

export interface SceneConsumer {
  readonly playBattleEvents: (
    events: readonly BattleEvent[],
    signal: AbortSignal,
  ) => Promise<void>;
  readonly handleSceneCommand: (command: SceneCommand) => void;
}

export interface BattleActionBatch {
  readonly events: readonly BattleEvent[];
  readonly commit: () => void;
  readonly onFailure?: (error: unknown) => void;
}

type AnchorListener = (anchors: readonly GameAnchor[]) => void;
type StatusListener = () => void;

interface ConsumerRegistration {
  readonly token: symbol;
  readonly consumer: SceneConsumer;
}

interface QueuedBatch {
  readonly events: readonly BattleEvent[];
  readonly commit?: () => void;
  readonly onFailure?: (error: unknown) => void;
  readonly resolve: (success: boolean) => void;
  settled: boolean;
}

const INITIAL_SNAPSHOT: BridgeSnapshot = Object.freeze({
  sceneReady: false,
  busy: false,
  sceneVersion: 0,
});

export class GameBridge {
  private anchors: readonly GameAnchor[] = Object.freeze([]);
  private readonly anchorListeners = new Set<AnchorListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private snapshot: BridgeSnapshot = INITIAL_SNAPSHOT;
  private sceneConsumer: ConsumerRegistration | null = null;
  private readonly queue: QueuedBatch[] = [];
  private activeBatch: QueuedBatch | null = null;
  private activeAbortController: AbortController | null = null;
  private workerToken: symbol | null = null;

  publishAnchors(anchors: readonly GameAnchor[]): void {
    this.anchors = Object.freeze([...anchors]);
    this.anchorListeners.forEach((listener) => listener(this.anchors));
  }

  getAnchors(): readonly GameAnchor[] {
    return this.anchors;
  }

  subscribeAnchors(listener: AnchorListener): () => void {
    this.anchorListeners.add(listener);
    listener(this.anchors);
    return () => {
      this.anchorListeners.delete(listener);
    };
  }

  readonly getSnapshot = (): BridgeSnapshot => this.snapshot;

  readonly subscribeStatus = (listener: StatusListener): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  registerSceneConsumer(consumer: SceneConsumer): () => void {
    const registration: ConsumerRegistration = {
      token: Symbol('scene-consumer'),
      consumer,
    };
    const previousRegistration = this.sceneConsumer;

    this.sceneConsumer = registration;
    this.setSnapshot({
      sceneReady: true,
      busy: this.snapshot.busy,
      sceneVersion: this.snapshot.sceneVersion + 1,
    });

    if (previousRegistration) {
      this.cancelAllBatches(new Error('The battle scene consumer was replaced.'));
    }

    return () => {
      if (this.sceneConsumer?.token !== registration.token) return;

      this.sceneConsumer = null;
      this.setSnapshot({
        sceneReady: false,
        busy: this.snapshot.busy,
        sceneVersion: this.snapshot.sceneVersion + 1,
      });
      this.cancelAllBatches(new Error('The battle scene consumer was removed.'));
    };
  }

  enqueueBattleEvents(events: readonly BattleEvent[]): Promise<boolean> {
    if (events.length === 0 || !this.snapshot.sceneReady || !this.sceneConsumer) {
      return Promise.resolve(false);
    }

    return this.enqueueBatch({ events });
  }

  enqueueBattleAction(factory: () => BattleActionBatch): Promise<boolean> {
    if (this.snapshot.busy || !this.snapshot.sceneReady || !this.sceneConsumer) {
      return Promise.resolve(false);
    }

    const registration = this.sceneConsumer;
    const sceneVersion = this.snapshot.sceneVersion;
    this.setBusy(true);

    if (
      !this.snapshot.sceneReady ||
      !this.sceneConsumer ||
      this.sceneConsumer.token !== registration.token ||
      this.snapshot.sceneVersion !== sceneVersion
    ) {
      this.setBusy(false);
      return Promise.resolve(false);
    }

    let action: BattleActionBatch;
    try {
      action = factory();
    } catch (error: unknown) {
      console.error('[GameBridge] Failed to resolve a battle action.', error);
      this.setBusy(false);
      return Promise.resolve(false);
    }

    if (action.events.length === 0) {
      this.setBusy(false);
      return Promise.resolve(false);
    }

    if (
      !this.snapshot.sceneReady ||
      !this.sceneConsumer ||
      this.sceneConsumer.token !== registration.token ||
      this.snapshot.sceneVersion !== sceneVersion
    ) {
      const error = new Error('The battle scene changed while resolving an action.');
      this.notifyFailure(action.onFailure, error);
      this.setBusy(false);
      return Promise.resolve(false);
    }

    return this.enqueueBatch(action);
  }

  sendSceneCommand(command: SceneCommand): boolean {
    const registration = this.sceneConsumer;
    if (!this.snapshot.sceneReady || !registration) return false;

    try {
      registration.consumer.handleSceneCommand(command);
      return this.sceneConsumer?.token === registration.token;
    } catch (error: unknown) {
      console.error('[GameBridge] Failed to handle a scene command.', error);
      return false;
    }
  }

  private enqueueBatch(batch: {
    readonly events: readonly BattleEvent[];
    readonly commit?: () => void;
    readonly onFailure?: (error: unknown) => void;
  }): Promise<boolean> {
    const events = Object.freeze([...batch.events]);

    const completion = new Promise<boolean>((resolve) => {
      this.queue.push({
        events,
        commit: batch.commit,
        onFailure: batch.onFailure,
        resolve,
        settled: false,
      });
    });

    this.setBusy(true);
    this.startWorker();
    return completion;
  }

  private startWorker(): void {
    if (this.workerToken) return;

    const workerToken = Symbol('battle-event-worker');
    this.workerToken = workerToken;
    void this.processQueue(workerToken);
  }

  private async processQueue(workerToken: symbol): Promise<void> {
    while (this.workerToken === workerToken) {
      const batch = this.queue.shift();
      if (!batch) break;

      const registration = this.sceneConsumer;
      const sceneVersion = this.snapshot.sceneVersion;
      if (!registration || !this.snapshot.sceneReady) {
        this.failWorker(
          workerToken,
          batch,
          new Error('No battle scene consumer is ready.'),
        );
        return;
      }

      const abortController = new AbortController();
      this.activeBatch = batch;
      this.activeAbortController = abortController;

      try {
        await registration.consumer.playBattleEvents(batch.events, abortController.signal);

        if (this.workerToken !== workerToken) return;
        if (
          abortController.signal.aborted ||
          !this.snapshot.sceneReady ||
          this.snapshot.sceneVersion !== sceneVersion ||
          this.sceneConsumer?.token !== registration.token
        ) {
          throw new Error('The battle scene consumer changed during event playback.');
        }

        batch.commit?.();
        this.settleBatch(batch, true);
        this.activeBatch = null;
        this.activeAbortController = null;
      } catch (error: unknown) {
        if (this.workerToken !== workerToken) return;
        this.failWorker(workerToken, batch, error);
        return;
      }
    }

    if (this.workerToken !== workerToken) return;

    this.workerToken = null;
    this.activeBatch = null;
    this.activeAbortController = null;
    this.setBusy(false);
  }

  private failWorker(workerToken: symbol, batch: QueuedBatch, error: unknown): void {
    if (this.workerToken !== workerToken) return;

    console.error('[GameBridge] Battle event playback failed.', error);
    this.workerToken = null;
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.activeBatch = null;

    this.settleBatch(batch, false, error);
    this.drainPendingBatches(error);
    this.setBusy(false);
  }

  private cancelAllBatches(error: unknown): void {
    this.workerToken = null;
    this.activeAbortController?.abort();
    this.activeAbortController = null;

    if (this.activeBatch) {
      this.settleBatch(this.activeBatch, false, error);
      this.activeBatch = null;
    }

    this.drainPendingBatches(error);
    this.setBusy(false);
  }

  private drainPendingBatches(error: unknown): void {
    const pendingBatches = this.queue.splice(0);
    pendingBatches.forEach((batch) => this.settleBatch(batch, false, error));
  }

  private settleBatch(batch: QueuedBatch, success: boolean, error?: unknown): void {
    if (batch.settled) return;
    batch.settled = true;

    if (!success) {
      this.notifyFailure(batch.onFailure, error);
    }
    batch.resolve(success);
  }

  private notifyFailure(
    onFailure: ((error: unknown) => void) | undefined,
    error: unknown,
  ): void {
    if (!onFailure) return;

    try {
      onFailure(error);
    } catch (recoveryError: unknown) {
      console.error('[GameBridge] Battle action recovery failed.', recoveryError);
    }
  }

  private setBusy(busy: boolean): void {
    if (this.snapshot.busy === busy) return;
    this.setSnapshot({ ...this.snapshot, busy });
  }

  private setSnapshot(snapshot: BridgeSnapshot): void {
    if (
      this.snapshot.sceneReady === snapshot.sceneReady &&
      this.snapshot.busy === snapshot.busy &&
      this.snapshot.sceneVersion === snapshot.sceneVersion
    ) {
      return;
    }

    this.snapshot = Object.freeze(snapshot);
    this.statusListeners.forEach((listener) => listener());
  }
}

export const gameBridge = new GameBridge();
