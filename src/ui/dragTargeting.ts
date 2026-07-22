import type { GameAnchor } from '../bridge/GameBridge';
import type { ActionId } from '../core/types';

export interface TargetBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface DropTargetQuery {
  readonly actionId: ActionId;
  readonly clientX: number;
  readonly clientY: number;
  readonly anchors: readonly GameAnchor[];
  readonly bounds: TargetBounds;
  readonly cancelled?: boolean;
}

export interface ActionPreview {
  readonly title: string;
  readonly detail: string;
}

function assertUnsupportedAction(actionId: never): never {
  throw new Error(`Unsupported action ID: ${String(actionId)}`);
}

export function getExpectedTargetKind(actionId: ActionId): GameAnchor['kind'] {
  switch (actionId) {
    case 'gap-slash':
      return 'actor';
    case 'stop-word':
      return 'intent';
    default:
      return assertUnsupportedAction(actionId);
  }
}

export function getActionPreview(actionId: ActionId): ActionPreview {
  switch (actionId) {
    case 'gap-slash':
      return { title: '틈새 베기', detail: '피해 6 · 틈 +1' };
    case 'stop-word':
      return { title: '내리치기 취소', detail: '받을 피해 9 → 0' };
    default:
      return assertUnsupportedAction(actionId);
  }
}

export function findDropTarget({
  actionId,
  clientX,
  clientY,
  anchors,
  bounds,
  cancelled = false,
}: DropTargetQuery): GameAnchor | null {
  if (cancelled || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const expectedKind = getExpectedTargetKind(actionId);
  let closest: { readonly anchor: GameAnchor; readonly distance: number } | null = null;

  for (const anchor of anchors) {
    if (anchor.kind !== expectedKind) {
      continue;
    }

    const anchorX = bounds.left + bounds.width * anchor.x;
    const anchorY = bounds.top + bounds.height * anchor.y;
    const hitRadius = Math.max(44, bounds.width * anchor.radius);
    const distance = Math.hypot(clientX - anchorX, clientY - anchorY);

    if (distance <= hitRadius && (!closest || distance < closest.distance)) {
      closest = { anchor, distance };
    }
  }

  return closest?.anchor ?? null;
}
