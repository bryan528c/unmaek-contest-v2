import type { BattleEvent } from '../core/types';

export type AnchorKind = 'actor' | 'intent';

export interface GameAnchor {
  id: 'enemy-body' | 'enemy-intent';
  kind: AnchorKind;
  x: number;
  y: number;
  radius: number;
  label: string;
}

type AnchorListener = (anchors: GameAnchor[]) => void;
type EventListener = (events: BattleEvent[]) => void;

class GameBridge {
  private anchors: GameAnchor[] = [];
  private anchorListeners = new Set<AnchorListener>();
  private eventListeners = new Set<EventListener>();

  publishAnchors(anchors: GameAnchor[]): void {
    this.anchors = anchors;
    this.anchorListeners.forEach((listener) => listener(this.anchors));
  }

  getAnchors(): GameAnchor[] {
    return this.anchors;
  }

  subscribeAnchors(listener: AnchorListener): () => void {
    this.anchorListeners.add(listener);
    listener(this.anchors);
    return () => this.anchorListeners.delete(listener);
  }

  emitBattleEvents(events: BattleEvent[]): void {
    if (events.length === 0) return;
    this.eventListeners.forEach((listener) => listener(events));
  }

  subscribeBattleEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
}

export const gameBridge = new GameBridge();
