import { useEffect, useRef } from 'react';
import { createPhaserGame } from './config';

export function PhaserStage() {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const game = createPhaserGame(parentRef.current);
    return () => game.destroy(true);
  }, []);

  return <div ref={parentRef} className="phaser-stage" aria-hidden="true" />;
}
