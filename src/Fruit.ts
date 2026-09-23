import { ColorRGB, FruitHalf, FruitTypeConfig } from './types';
import { Particle } from './Particle';

export const FRUIT_TYPES: FruitTypeConfig[] = [
  { name: 'Apple', color: { r: 220, g: 40, b: 40 }, splashColor: 'rgba(220, 40, 40, 0.8)' },
  { name: 'Orange', color: { r: 255, g: 140, b: 0 }, splashColor: 'rgba(255, 140, 0, 0.8)' },
  { name: 'Watermelon', color: { r: 40, g: 180, b: 90 }, splashColor: 'rgba(40, 180, 90, 0.8)' },
  { name: 'Grape', color: { r: 150, g: 40, b: 190 }, splashColor: 'rgba(150, 40, 190, 0.8)' },
  { name: 'Banana', color: { r: 255, g: 210, b: 30 }, splashColor: 'rgba(255, 210, 30, 0.8)' },
];

export const BOMB_COLOR: ColorRGB = { r: 25, g: 25, b: 25 };

export class Fruit {
  public isBomb: boolean;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number;
  public color: ColorRGB;
  public splashColor: string;
  public sliced: boolean = false;
  public alive: boolean = true;
  public rot: number = 0;
  public spin: number;

  public halves: FruitHalf[] = [];

  constructor(isBomb = false, canvasWidth = 960, canvasHeight = 720) {
    this.isBomb = isBomb;
    this.x = 90 + Math.random() * (canvasWidth - 180);
    this.y = canvasHeight + 50;

    this.vx = (Math.random() - 0.5) * 220;
    this.vy = -(780 + Math.random() * 200);

    this.radius = isBomb ? 38 : 42;

    if (isBomb) {
      this.color = BOMB_COLOR;
      this.splashColor = 'rgba(255, 100, 0, 0.9)';
    } else {
      const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      this.color = type.color;
      this.splashColor = type.splashColor;
    }

    this.spin = (Math.random() - 0.5) * 6;
  }

  public update(dt: number, gravity: number, canvasHeight: number, particles: Particle[]): void {
    if (!this.sliced) {
      this.vy += gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;

      // Generate bomb fuse sparks
      if (this.isBomb && this.alive && Math.random() < 0.6) {
        const fx = this.x + Math.cos(this.rot) * 14;
        const fy = this.y - this.radius - 14;
        particles.push(
          new Particle(fx, fy, 'rgb(255, 210, 60)', {
            speedMin: 20,
            speedMax: 80,
            lifeMin: 0.1,
            lifeMax: 0.25,
            radiusMin: 2,
            radiusMax: 4,
            gravity: 100,
          })
        );
      }

      if (this.y - this.radius > canvasHeight + 60) {
        this.alive = false;
      }
    } else {
      // Update sliced halves
      let allHalvesInvisible = true;
      for (const h of this.halves) {
        h.vy += gravity * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rot += h.spin * dt;
        h.alpha = Math.max(0, h.alpha - dt * 0.8);
        if (h.alpha > 0) allHalvesInvisible = false;
      }
      if (allHalvesInvisible) {
        this.alive = false;
      }
    }
  }

  public slice(): void {
    this.sliced = true;
    if (this.isBomb) return;

    // Create 2 half pieces flying apart
    this.halves = [
      {
        x: this.x - 10,
        y: this.y,
        vx: this.vx - 120,
        vy: this.vy - 60,
        radius: this.radius,
        color: this.color,
        rot: this.rot,
        spin: -4,
        side: -1,
        alpha: 1,
      },
      {
        x: this.x + 10,
        y: this.y,
        vx: this.vx + 120,
        vy: this.vy - 60,
        radius: this.radius,
        color: this.color,
        rot: this.rot,
        spin: 4,
        side: 1,
        alpha: 1,
      },
    ];
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.sliced) {
      ctx.save();
      ctx.translate(this.x, this.y);

      if (this.isBomb) {
        // Draw Bomb
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#dcdde1';
        ctx.stroke();

        // Bomb fuse
        const fx = Math.cos(this.rot) * 14;
        const fy = -this.radius - 14;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.quadraticCurveTo(fx / 2, -this.radius - 10, fx, fy);
        ctx.strokeStyle = '#ff9f43';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Fuse spark head
        ctx.beginPath();
        ctx.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#feca57';
        ctx.fill();
      } else {
        // Draw Whole Fruit
        ctx.rotate(this.rot);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
        ctx.fill();

        // Glossy Highlight
        const hiR = Math.min(255, this.color.r + 70);
        const hiG = Math.min(255, this.color.g + 70);
        const hiB = Math.min(255, this.color.b + 70);
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${hiR}, ${hiG}, ${hiB})`;
        ctx.fill();
      }

      ctx.restore();
    } else {
      // Draw Sliced Halves
      for (const h of this.halves) {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);

        ctx.beginPath();
        if (h.side === -1) {
          ctx.arc(0, 0, h.radius, Math.PI * 0.5, Math.PI * 1.5);
        } else {
          ctx.arc(0, 0, h.radius, Math.PI * 1.5, Math.PI * 0.5);
        }
        ctx.closePath();
        ctx.fillStyle = `rgb(${h.color.r}, ${h.color.g}, ${h.color.b})`;
        ctx.fill();

        // Inner flesh background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.restore();
      }
    }
  }
}
