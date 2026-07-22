import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    backgroundColor: '#101820',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scene: [BattleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 360,
    },
    render: {
      pixelArt: true,
      roundPixels: true,
      antialias: false,
    },
  });
}
