import { describe, expect, it } from 'vitest';
import type { GameAnchor } from '../src/bridge/GameBridge';
import type { ActionId } from '../src/core/types';
import {
  findDropTarget,
  getActionPreview,
  getExpectedTargetKind,
} from '../src/ui/dragTargeting';

const bounds = { left: 100, top: 50, width: 1_000, height: 562.5 } as const;

const anchors: readonly GameAnchor[] = [
  { id: 'enemy-body', kind: 'actor', x: 0.75, y: 0.55, radius: 0.1, label: '돌짐승' },
  { id: 'enemy-intent', kind: 'intent', x: 0.75, y: 0.25, radius: 0.08, label: '내리친다' },
];

describe('dragTargeting', () => {
  it('maps each supported action to its explicit target kind', () => {
    expect(getExpectedTargetKind('gap-slash')).toBe('actor');
    expect(getExpectedTargetKind('stop-word')).toBe('intent');
  });

  it('finds the enemy body for gap-slash from the final pointer coordinates', () => {
    expect(findDropTarget({
      actionId: 'gap-slash',
      clientX: 850,
      clientY: 359.375,
      anchors,
      bounds,
    })?.id).toBe('enemy-body');
  });

  it('does not accept an anchor of the wrong kind', () => {
    expect(findDropTarget({
      actionId: 'gap-slash',
      clientX: 850,
      clientY: 190.625,
      anchors,
      bounds,
    })).toBeNull();
  });

  it('chooses the nearest compatible anchor when hit areas overlap', () => {
    const overlapping: readonly GameAnchor[] = [
      { id: 'enemy-body', kind: 'actor', x: 0.5, y: 0.5, radius: 0.2, label: '먼 대상' },
      { id: 'enemy-body', kind: 'actor', x: 0.55, y: 0.5, radius: 0.2, label: '가까운 대상' },
    ];

    expect(findDropTarget({
      actionId: 'gap-slash',
      clientX: 655,
      clientY: 331.25,
      anchors: overlapping,
      bounds,
    })?.label).toBe('가까운 대상');
  });

  it('returns no target for pointercancel even when the pointer is valid', () => {
    expect(findDropTarget({
      actionId: 'stop-word',
      clientX: 850,
      clientY: 190.625,
      anchors,
      bounds,
      cancelled: true,
    })).toBeNull();
  });

  it('rejects an unknown action instead of treating it as another supported action', () => {
    const unknownAction = 'unknown-action' as ActionId;

    expect(() => getExpectedTargetKind(unknownAction)).toThrow('Unsupported action ID: unknown-action');
    expect(() => getActionPreview(unknownAction)).toThrow('Unsupported action ID: unknown-action');
  });
});
