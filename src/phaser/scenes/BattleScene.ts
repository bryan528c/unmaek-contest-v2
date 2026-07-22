import Phaser from 'phaser';
import { gameBridge, type SceneCommand } from '../../bridge/GameBridge';
import type { BattleEvent, BattleState } from '../../core/types';

function assertNever(value: never): never {
  throw new Error(`지원하지 않는 전투 사건입니다: ${String(value)}`);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('전투 장면 사건 재생이 취소되었습니다.');
  }
}

export class BattleScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private enemy!: Phaser.GameObjects.Sprite;
  private enemyIntent!: Phaser.GameObjects.Text;
  private enemyIntentValue!: Phaser.GameObjects.Text;
  private crack!: Phaser.GameObjects.Graphics;
  private disposeSceneConsumer?: () => void;
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.disposeSceneConsumer?.();
    this.disposeSceneConsumer = undefined;
    this.createTextures();
    this.createBackground();

    this.player = this.add.sprite(150, 215, 'player-idle').setOrigin(0.5, 1);
    this.enemy = this.add.sprite(485, 220, 'enemy-idle').setOrigin(0.5, 1);

    this.enemyIntent = this.add
      .text(485, 78, '내리친다', {
        fontFamily: 'sans-serif',
        fontSize: '17px',
        color: '#f1ded3',
        stroke: '#111820',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.enemyIntentValue = this.add
      .text(485, 98, '피해 9', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#d8a095',
        stroke: '#111820',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.add
      .ellipse(485, 237, 142, 16, 0x06090d, 0.52)
      .setDepth(-1);

    this.add
      .ellipse(150, 237, 94, 12, 0x06090d, 0.42)
      .setDepth(-1);

    this.crack = this.add.graphics();
    this.publishAnchors();

    const dispose = gameBridge.registerSceneConsumer({
      playBattleEvents: (events, signal) => this.playEvents(events, signal),
      handleSceneCommand: (command) => this.handleSceneCommand(command),
    });
    this.disposeSceneConsumer = dispose;

    let cleanedUp = false;
    const cleanUp = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      dispose();
      if (this.disposeSceneConsumer === dispose) {
        this.disposeSceneConsumer = undefined;
      }
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanUp);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanUp);
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x16232d, 0x16232d, 0x0c1219, 0x0c1219, 1);
    bg.fillRect(0, 0, 640, 360);

    bg.fillStyle(0x25343b, 1);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        const offset = row % 2 === 0 ? 0 : 14;
        bg.fillRect(col * 56 - offset, 22 + row * 30, 48, 22);
      }
    }

    bg.fillStyle(0x11181f, 0.82);
    bg.fillRect(0, 250, 640, 110);

    bg.lineStyle(3, 0x344a3f, 0.75);
    bg.beginPath();
    bg.moveTo(20, 0);
    bg.lineTo(45, 82);
    bg.lineTo(36, 158);
    bg.lineTo(66, 234);
    bg.strokePath();

    bg.lineStyle(2, 0x6e8779, 0.25);
    bg.beginPath();
    bg.moveTo(390, 40);
    bg.lineTo(430, 66);
    bg.lineTo(410, 96);
    bg.strokePath();

    const mist = this.add.rectangle(320, 285, 640, 150, 0x92a9a1, 0.04);
    this.tweens.add({
      targets: mist,
      alpha: { from: 0.02, to: 0.08 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
    });
  }

  private createTextures(): void {
    if (this.textures.exists('player-idle')) return;

    const player = this.make.graphics({ x: 0, y: 0 });
    player.fillStyle(0x202832, 1);
    player.fillRect(15, 16, 22, 42);
    player.fillStyle(0xc8b39a, 1);
    player.fillRect(19, 6, 14, 13);
    player.fillStyle(0x40535b, 1);
    player.fillTriangle(9, 27, 20, 18, 18, 55);
    player.fillStyle(0x8b775e, 1);
    player.fillRect(36, 25, 18, 4);
    player.generateTexture('player-idle', 64, 64);
    player.destroy();

    const enemy = this.make.graphics({ x: 0, y: 0 });
    enemy.fillStyle(0x3d4547, 1);
    enemy.fillRect(18, 30, 70, 42);
    enemy.fillStyle(0x4f595a, 1);
    enemy.fillRect(40, 12, 55, 34);
    enemy.fillStyle(0x20272a, 1);
    enemy.fillTriangle(14, 54, 2, 78, 30, 68);
    enemy.fillTriangle(86, 56, 105, 78, 72, 70);
    enemy.fillStyle(0x95c7b8, 1);
    enemy.fillRect(74, 22, 6, 4);
    enemy.lineStyle(2, 0x7ea99d, 0.7);
    enemy.strokeLineShape(new Phaser.Geom.Line(48, 28, 65, 42));
    enemy.strokeLineShape(new Phaser.Geom.Line(62, 44, 52, 61));
    enemy.generateTexture('enemy-idle', 112, 84);
    enemy.destroy();
  }

  private publishAnchors(): void {
    gameBridge.publishAnchors([
      {
        id: 'enemy-body',
        kind: 'actor',
        x: 485 / 640,
        y: 190 / 360,
        radius: 0.105,
        label: '돌짐승',
      },
      {
        id: 'enemy-intent',
        kind: 'intent',
        x: 485 / 640,
        y: 88 / 360,
        radius: 0.085,
        label: '내리친다',
      },
    ]);
  }

  private async playEvents(
    events: readonly BattleEvent[],
    signal: AbortSignal,
  ): Promise<void> {
    for (const event of events) {
      throwIfAborted(signal);
      switch (event.type) {
        case 'playerAttack':
          await this.playAttack(event.damage, signal);
          break;
        case 'gapAdded':
          this.drawCrack();
          break;
        case 'intentCancelled':
          await this.playStopWord(signal);
          break;
        default:
          assertNever(event);
      }
      throwIfAborted(signal);
    }
  }

  private playAttack(damage: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let playerReturned = false;
      let damageFinished = false;
      let settled = false;
      const finishIfComplete = (): void => {
        if (settled || !playerReturned || !damageFinished) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        resolve();
      };
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        this.cancelActivePresentation();
        reject(error);
      };
      const handleAbort = (): void => fail(new Error('플레이어 공격 연출이 취소되었습니다.'));
      signal.addEventListener('abort', handleAbort, { once: true });

      const startX = this.player.x;
      this.tweens.add({
        targets: this.player,
        x: 374,
        duration: 135,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (settled) return;
          try {
            const slash = this.trackTransient(this.add.graphics());
            slash.lineStyle(5, 0xf0d0a4, 0.95);
            slash.beginPath();
            slash.arc(this.enemy.x - 8, this.enemy.y - 35, 45, 2.5, 5.6, false);
            slash.strokePath();
            this.time.delayedCall(85, () => {
              try {
                slash.destroy();
              } catch (error: unknown) {
                fail(error);
              }
            });

            const damageText = this.trackTransient(this.add
              .text(this.enemy.x, this.enemy.y - 94, `-${damage}`, {
                fontFamily: 'sans-serif',
                fontSize: '17px',
                color: '#ffd4c7',
                stroke: '#15191f',
                strokeThickness: 3,
              })
              .setOrigin(0.5));

            this.tweens.add({
              targets: damageText,
              y: damageText.y - 18,
              alpha: 0,
              duration: 520,
              onComplete: () => {
                try {
                  damageText.destroy();
                  damageFinished = true;
                  finishIfComplete();
                } catch (error: unknown) {
                  fail(error);
                }
              },
            });

            this.cameras.main.shake(75, 0.0045);
            this.tweens.add({
              targets: this.enemy,
              x: this.enemy.x + 7,
              duration: 45,
              yoyo: true,
              repeat: 2,
            });

            this.time.delayedCall(80, () => {
              if (settled) return;
              try {
                this.tweens.add({
                  targets: this.player,
                  x: startX,
                  duration: 155,
                  ease: 'Quad.easeOut',
                  onComplete: () => {
                    playerReturned = true;
                    finishIfComplete();
                  },
                });
              } catch (error: unknown) {
                fail(error);
              }
            });
          } catch (error: unknown) {
            fail(error);
          }
        },
      });
    });
  }

  private drawCrack(): void {
    this.crack.clear();
    this.crack.lineStyle(2, 0x8ed4be, 0.9);
    this.crack.beginPath();
    this.crack.moveTo(this.enemy.x - 8, this.enemy.y - 46);
    this.crack.lineTo(this.enemy.x + 5, this.enemy.y - 34);
    this.crack.lineTo(this.enemy.x - 2, this.enemy.y - 22);
    this.crack.lineTo(this.enemy.x + 13, this.enemy.y - 10);
    this.crack.strokePath();
  }

  private playStopWord(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        this.cancelActivePresentation();
        reject(error);
      };
      const handleAbort = (): void => fail(new Error('언령 연출이 취소되었습니다.'));
      signal.addEventListener('abort', handleAbort, { once: true });

      const word = this.trackTransient(this.add
        .text(188, 286, '멎는다.', {
          fontFamily: 'serif',
          fontSize: '21px',
          color: '#9df0d2',
          stroke: '#0d1717',
          strokeThickness: 4,
        })
        .setOrigin(0.5));

      const thread = this.trackTransient(this.add.graphics());
      thread.lineStyle(2, 0x86e6c8, 0.95);
      thread.beginPath();
      thread.moveTo(word.x + 26, word.y - 4);
      thread.lineTo(this.enemyIntent.x, this.enemyIntent.y);
      thread.strokePath();

      this.tweens.add({
        targets: word,
        x: this.enemyIntent.x,
        y: this.enemyIntent.y,
        duration: 320,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (settled) return;
          try {
            this.enemyIntent.setColor('#89e2c5');
            this.enemyIntent.setText('내리\n친다');
            this.enemyIntent.setLineSpacing(-4);
            this.enemyIntentValue.setText('피해 없음').setColor('#9ad5c0');
            this.enemy.setTint(0x9bc8b9);

            const fragments = Array.from({ length: 8 }, (_, index) =>
              this.trackTransient(this.add.rectangle(
                this.enemy.x - 25 + index * 7,
                this.enemy.y - 70 + (index % 3) * 7,
                3,
                3,
                0xa9e7d3,
                0.9,
              )),
            );

            this.time.delayedCall(145, () => {
              if (settled) return;
              try {
                fragments.forEach((fragment) => fragment.destroy());
                thread.destroy();
                word.destroy();
                this.enemy.clearTint();
                settled = true;
                signal.removeEventListener('abort', handleAbort);
                resolve();
              } catch (error: unknown) {
                fail(error);
              }
            });
          } catch (error: unknown) {
            fail(error);
          }
        },
      });
    });
  }

  private handleSceneCommand(command: SceneCommand): void {
    const commandType = command.type;
    switch (commandType) {
      case 'resetScene':
        this.resetScene(command.state);
        return;
      default:
        assertNever(commandType);
    }
  }

  private resetScene(state: BattleState): void {
    this.cancelActivePresentation();
    this.player.setPosition(150, 215);
    this.enemy.setPosition(485, 220).clearTint();
    if (state.enemyIntentCancelled) {
      this.enemyIntent.setText('내리\n친다').setColor('#89e2c5').setLineSpacing(-4);
      this.enemyIntentValue.setText('피해 없음').setColor('#9ad5c0');
    } else {
      this.enemyIntent.setText('내리친다').setColor('#f1ded3').setLineSpacing(0);
      this.enemyIntentValue.setText('피해 9').setColor('#d8a095');
    }
    if (state.enemyGap > 0) {
      this.drawCrack();
    } else {
      this.crack.clear();
    }
    this.cameras.main.resetFX();
  }

  private cancelActivePresentation(): void {
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.enemy);
    this.time.removeAllEvents();
    this.destroyTransientObjects();
    this.enemy.clearTint();
    this.cameras.main.resetFX();
  }

  private trackTransient<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.transientObjects.add(gameObject);
    gameObject.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.transientObjects.delete(gameObject);
    });
    return gameObject;
  }

  private destroyTransientObjects(): void {
    const objects = [...this.transientObjects];
    this.transientObjects.clear();
    objects.forEach((gameObject) => {
      this.tweens.killTweensOf(gameObject);
      if (gameObject.active) gameObject.destroy();
    });
  }
}
