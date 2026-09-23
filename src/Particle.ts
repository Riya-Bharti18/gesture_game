import { ColorRGB } from './types';

export class Particle {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public color: ColorRGB | string;
  public life: number;
  public age: number = 0;
  public radius: number;
  public gravity: number;

  constructor(
    x: number,
    y: number,
    color: ColorRGB | string,
    options?: {
      speedMin?: number;
      speedMax?: number;
      lifeMin?: number;
      lifeMax?: number;
      radiusMin?: number;
      radiusMax?: number;
      gravity?: number;
    }
  ) {
    this.x = x;
    this.y = y;
    this.color = color;

    const angle = Math.random() * Math.PI * 2;
    const speedMin = options?.speedMin ?? 90;
    const speedMax = options?.speedMax ?? 340;
    const speed = speedMin + Math.random() * (speedMax - speedMin);

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    const lifeMin = options?.lifeMin ?? 0.35;
    const lifeMax = options?.lifeMax ?? 0.75;
    this.life = lifeMin + Math.random() * (lifeMax - lifeMin);

    const radiusMin = options?.radiusMin ?? 3;
    const radiusMax = options?.radiusMax ?? 6;
    this.radius = Math.floor(radiusMin + Math.random() * (radiusMax - radiusMin + 1));

    this.gravity = options?.gravity ?? 520;
  }

  public update(dt: number): void {
    this.age += dt;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  public isAlive(): boolean {
    return this.age < this.life;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0, 1 - this.age / this.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    if (typeof this.color === 'string') {
      ctx.fillStyle = this.color;
    } else {
      ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    }

    ctx.fill();
    ctx.restore();
  }
}
