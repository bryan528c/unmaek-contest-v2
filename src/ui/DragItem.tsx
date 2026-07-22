import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

interface DragItemProps {
  className: string;
  disabled?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

export function DragItem({ className, disabled, onPointerDown, children }: DragItemProps) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onPointerDown={onPointerDown}
    >
      {children}
    </button>
  );
}
