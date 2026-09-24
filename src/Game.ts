import { FloatingText, GameState, Point } from './types';
import { Fruit } from './Fruit';
import { Particle } from './Particle';
import { SoundEffects } from './SoundEffects';
import { HandTracker } from './HandTracker';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public readonly width = 960;
  public readonly height = 720;
  public readonly gravity = 900;
  public readonly gameDuration = 60;
  public readonly startingLives = 3;
  public readonly spawnIntervalRange: [number, number] = [0.55, 1.3];
  public readonly bombChance = 0.18;
  public readonly sliceSpeedThreshold = 350;

  public state: GameState = 'menu';
  public fruits: Fruit[] = [];
  public particles: Particle[] = [];
  public trail: Point[] = [];
  public floatingTexts: FloatingText[] = [];
  public score = 0;
  public highScore = 0;
  public combo = 0;
  public comboTimer = 0;
  public lives = 3;
  public startTime = 0;
  public nextSpawn = 0;
  public gameOverReason = '';
  public flashRedTimer = 0;

  private sound: SoundEffects;
  private tracker: HandTracker;

  private lastTime = 0;
  private mousePos: Point | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    _videoElement: HTMLVideoElement,
    sound: SoundEffects,
    tracker: HandTracker
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.sound = sound;
    this.tracker = tracker;

    this.loadHighScore();
    this.setupEventListeners();
  }

  private loadHighScore(): void {
    const saved = localStorage.getItem('fn_high_score');
    if (saved) {
      this.highScore = parseInt(saved, 10) || 0;
    }
  }

  private saveHighScore(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('fn_high_score', this.highScore.toString());
    }
  }

  private setupEventListeners(): void {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.state === 'menu' || this.state === 'gameover') {
          this.reset(false);
        }
      }
    });

    // Mouse / Touch fallback controls
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.mousePos = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        t: performance.now() / 1000,
      };
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        this.mousePos = {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
          t: performance.now() / 1000,
        };
      }
    }, { passive: false });

    this.canvas.addEventListener('click', () => {
      if (this.state === 'menu' || this.state === 'gameover') {
        this.reset(false);
      }
    });
  }

  public reset(full = false): void {
    this.fruits = [];
    this.particles = [];
    this.trail = [];
    this.floatingTexts = [];
    this.flashRedTimer = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lives = this.startingLives;
    this.startTime = performance.now() / 1000;
    this.nextSpawn = this.startTime + this.getRandomSpawnInterval();
    this.state = full ? 'menu' : 'playing';
    this.gameOverReason = '';
    this.sound.playButtonClick();
  }

  private getRandomSpawnInterval(): number {
    const min = this.spawnIntervalRange[0];
    const max = this.spawnIntervalRange[1];
    return min + Math.random() * (max - min);
  }

  public getTimeLeft(): number {
    if (this.state !== 'playing') return this.gameDuration;
    const elapsed = performance.now() / 1000 - this.startTime;
    return Math.max(0, this.gameDuration - elapsed);
  }

  private spawnFruit(): void {
    const isBomb = Math.random() < this.bombChance;
    this.fruits.push(new Fruit(isBomb, this.width, this.height));
    this.nextSpawn = performance.now() / 1000 + this.getRandomSpawnInterval();
  }

  private triggerSliceEffects(fruit: Fruit): void {
    for (let i = 0; i < 24; i++) {
      this.particles.push(
        new Particle(fruit.x, fruit.y, fruit.color, {
          speedMin: 120,
          speedMax: 420,
          lifeMin: 0.4,
          lifeMax: 0.85,
          radiusMin: 3,
          radiusMax: 7,
          gravity: 600,
        })
      );
    }
  }

  private segmentHitsCircle(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    center: { x: number; y: number },
    radius: number
  ): boolean {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.hypot(center.x - p1.x, center.y - p1.y) <= radius;
    }

    const t = Math.max(0, Math.min(1, ((center.x - p1.x) * dx + (center.y - p1.y) * dy) / lenSq));
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;

    return Math.hypot(center.x - closestX, center.y - closestY) <= radius;
  }

  private handleSlicing(): void {
    if (this.trail.length < 2) return;

    const p1 = this.trail[this.trail.length - 2];
    const p2 = this.trail[this.trail.length - 1];

    const dtMove = Math.max(p2.t - p1.t, 0.0001);
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const speed = dist / dtMove;

    if (speed < this.sliceSpeedThreshold) return;

    this.sound.playSwoosh();

    for (const fruit of this.fruits) {
      if (fruit.sliced || !fruit.alive) continue;

      if (this.segmentHitsCircle(p1, p2, { x: fruit.x, y: fruit.y }, fruit.radius)) {
        fruit.slice();

        if (fruit.isBomb) {
          fruit.alive = false;
          this.sound.playBombExplosion();
          this.sound.playLifeLost();
          this.combo = 0;
          this.comboTimer = 0;
          this.lives -= 1;
          this.flashRedTimer = 0.5;

          for (let i = 0; i < 40; i++) {
            this.particles.push(
              new Particle(fruit.x, fruit.y, '#ff4757', {
                speedMin: 150,
                speedMax: 500,
                lifeMin: 0.5,
                lifeMax: 1.0,
                radiusMin: 4,
                radiusMax: 9,
              })
            );
          }

          if (this.lives <= 0) {
            this.state = 'gameover';
            this.gameOverReason = 'Sliced a Bomb & Out of Lives!';
            this.saveHighScore();
          } else {
            this.addFloatingText('-1 ❤️', fruit.x, fruit.y);
          }
        } else {
          this.combo += 1;
          this.comboTimer = 1.0;
          const points = 10 * Math.max(1, this.combo);
          this.score += points;
          this.saveHighScore();

          if (this.combo > 1) {
            this.sound.playCombo(this.combo);
          } else {
            this.sound.playSlice();
          }

          this.triggerSliceEffects(fruit);
        }
      }
    }
  }

  public update(nowPos: Point | null, isPinch = false): void {
    const now = performance.now() / 1000;
    const dt = Math.min(now - (this.lastTime || now), 0.05);
    this.lastTime = now;

    let activePoint: Point | null = null;
    if (this.tracker.currentInputMode === 'hand') {
      activePoint = nowPos;
    } else {
      activePoint = this.mousePos;
    }

    if (this.state === 'menu' || this.state === 'gameover') {
      if (isPinch) {
        this.reset(false);
      }
    }

    if (this.state === 'playing') {
      if (activePoint) {
        this.trail.push({ x: activePoint.x, y: activePoint.y, t: now });
        if (this.trail.length > 10) {
          this.trail.shift();
        }
        this.handleSlicing();
      } else {
        this.trail = [];
      }

      if (this.flashRedTimer > 0) {
        this.flashRedTimer = Math.max(0, this.flashRedTimer - dt);
      }

      for (const ft of this.floatingTexts) {
        ft.age += dt;
        ft.y += ft.vy * dt;
        ft.alpha = Math.max(0, 1 - ft.age / ft.life);
      }
      this.floatingTexts = this.floatingTexts.filter((ft) => ft.age < ft.life);

      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
        }
      }

      if (now >= this.nextSpawn) {
        this.spawnFruit();
      }

      for (const fruit of this.fruits) {
        fruit.update(dt, this.gravity, this.height, this.particles);
        if (!fruit.alive && !fruit.sliced && !fruit.isBomb) {
          this.lives -= 1;
          this.sound.playLifeLost();
          this.flashRedTimer = 0.5;
          this.addFloatingText('-1 ❤️', fruit.x, Math.min(fruit.y - 20, this.height - 60));
          if (this.lives <= 0) {
            this.state = 'gameover';
            this.gameOverReason = 'Out of Lives!';
            this.saveHighScore();
          }
        }
      }

      this.fruits = this.fruits.filter((f) => f.alive);

      for (const p of this.particles) {
        p.update(dt);
      }
      this.particles = this.particles.filter((p) => p.isAlive());

      if (this.getTimeLeft() <= 0) {
        this.state = 'gameover';
        this.gameOverReason = "Time's Up!";
        this.saveHighScore();
      }
    }
  }

  public addFloatingText(text: string, x: number, y: number): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -60,
      alpha: 1.0,
      life: 1.0,
      age: 0,
    });
  }

  public draw(activePoint: Point | null = null): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw webcam feed or background grid
    const video = this.tracker.getVideoElement();
    if (this.tracker.isCameraReady && video.readyState >= 2) {
      this.ctx.save();
      // Mirror video feed horizontally
      this.ctx.translate(this.width, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(video, 0, 0, this.width, this.height);
      this.ctx.restore();
    } else {
      // Tech dark background pattern
      this.ctx.fillStyle = '#0f111a';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // 2. Dark overlay for game contrast
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 3. Draw Fruits & Bombs
    for (const fruit of this.fruits) {
      fruit.draw(this.ctx);
    }

    // 4. Draw Particles
    for (const p of this.particles) {
      p.draw(this.ctx);
    }

    // 5. Draw Blade Slice Trail
    this.drawTrail();

    // 6. Draw Red Flash Vignette on Life Loss
    if (this.flashRedTimer > 0) {
      this.ctx.save();
      this.ctx.fillStyle = `rgba(255, 71, 87, ${this.flashRedTimer * 0.7})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }

    // 7. Draw Floating Popups (-1 ❤️, Combos)
    for (const ft of this.floatingTexts) {
      this.ctx.save();
      this.ctx.globalAlpha = ft.alpha;
      this.ctx.font = '800 30px "Outfit", sans-serif';
      this.ctx.fillStyle = '#ff4757';
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 8;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }

    // 8. Draw Fingertip Cursor Dot Indicator
    const targetPoint = this.tracker.currentInputMode === 'hand' ? activePoint : this.mousePos;
    if (targetPoint) {
      this.drawFingertipCursor(targetPoint.x, targetPoint.y);
    }

    // 9. Draw HUD & State Screens
    if (this.state === 'menu') {
      this.drawMenu();
    } else if (this.state === 'playing') {
      this.drawHUD();
    } else if (this.state === 'gameover') {
      this.drawHUD();
      this.drawGameOver();
    }
  }

  private drawFingertipCursor(x: number, y: number): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#00d2d3';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00d2d3';
    this.ctx.shadowBlur = 15;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTrail(): void {
    if (this.trail.length < 2) return;

    this.ctx.save();
    for (let i = 1; i < this.trail.length; i++) {
      const alpha = i / this.trail.length;
      const width = Math.max(2, 10 * alpha);

      this.ctx.beginPath();
      this.ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.shadowColor = '#00d2d3';
      this.ctx.shadowBlur = 12;
      this.ctx.lineWidth = width;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawGlassPanel(x: number, y: number, w: number, h: number, radius = 18): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, radius);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.fill();
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawHUD(): void {
    // Score Badge
    this.drawGlassPanel(20, 20, 220, 60);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 24px "Outfit", sans-serif';
    this.ctx.fillText(`Score  ${this.score}`, 38, 58);

    // High Score Badge
    this.drawGlassPanel(260, 20, 180, 60);
    this.ctx.fillStyle = '#ffd32a';
    this.ctx.font = '600 18px "Outfit", sans-serif';
    this.ctx.fillText(`Best  ${this.highScore}`, 278, 56);

    // Time Left Badge
    this.drawGlassPanel(this.width - 240, 20, 220, 60);
    const t = Math.floor(this.getTimeLeft());
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 24px "Outfit", sans-serif';
    this.ctx.fillText(`Time  ${t.toString().padStart(2, '0')}s`, this.width - 220, 58);

    // Lives Badge (Hearts)
    this.drawGlassPanel(20, 96, 180, 46);
    this.ctx.font = '24px "Outfit", sans-serif';
    const totalLives = this.startingLives;
    const remainingLives = Math.max(0, Math.min(totalLives, this.lives));
    const hearts = '❤️ '.repeat(remainingLives) + '🖤 '.repeat(totalLives - remainingLives);
    this.ctx.fillText(hearts.trim(), 34, 128);

    // Combo Alert Badge
    if (this.combo > 1) {
      this.drawGlassPanel(this.width / 2 - 100, 20, 200, 54);
      this.ctx.fillStyle = '#ffd32a';
      this.ctx.font = '800 22px "Outfit", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`COMBO x${this.combo}`, this.width / 2, 54);
      this.ctx.textAlign = 'left';
    }
  }

  private drawMenu(): void {
    this.drawGlassPanel(this.width / 2 - 270, this.height / 2 - 150, 540, 300, 26);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '900 52px "Outfit", sans-serif';
    this.ctx.fillText('FRUIT NINJA', this.width / 2, this.height / 2 - 70);

    this.ctx.fillStyle = '#a0a5b5';
    this.ctx.font = '600 18px "Inter", sans-serif';
    this.ctx.fillText('You get 3 Lives! Slicing bombs or missing fruit loses 1 ❤️', this.width / 2, this.height / 2 - 20);

    this.ctx.fillStyle = '#ffd32a';
    this.ctx.font = '700 24px "Outfit", sans-serif';
    this.ctx.fillText('Click or Press SPACE to Start', this.width / 2, this.height / 2 + 50);

    this.ctx.textAlign = 'left';
  }

  private drawGameOver(): void {
    this.drawGlassPanel(this.width / 2 - 270, this.height / 2 - 160, 540, 320, 26);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff4757';
    this.ctx.font = '900 48px "Outfit", sans-serif';
    this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 90);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '600 20px "Inter", sans-serif';
    this.ctx.fillText(this.gameOverReason, this.width / 2, this.height / 2 - 40);

    this.ctx.fillStyle = '#ffd32a';
    this.ctx.font = '800 28px "Outfit", sans-serif';
    this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 10);

    this.ctx.fillStyle = '#a0a5b5';
    this.ctx.font = '600 16px "Inter", sans-serif';
    this.ctx.fillText(`High Score: ${this.highScore}`, this.width / 2, this.height / 2 + 42);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 20px "Outfit", sans-serif';
    this.ctx.fillText('Click or Press SPACE to Play Again', this.width / 2, this.height / 2 + 90);

    this.ctx.textAlign = 'left';
  }
}
