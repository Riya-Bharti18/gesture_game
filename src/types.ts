export type GameState = 'menu' | 'playing' | 'gameover';
export type InputMode = 'hand' | 'mouse';

export interface Point {
  x: number;
  y: number;
  t: number;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface FruitTypeConfig {
  name: string;
  color: ColorRGB;
  splashColor: string;
}

export interface FruitHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: ColorRGB;
  rot: number;
  spin: number;
  side: -1 | 1; // Left or Right half
  alpha: number;
}

export interface ParticleOptions {
  x: number;
  y: number;
  color: ColorRGB | string;
  speedMin?: number;
  speedMax?: number;
  lifeMin?: number;
  lifeMax?: number;
  radiusMin?: number;
  radiusMax?: number;
  gravity?: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandResults {
  multiHandLandmarks?: HandLandmark[][];
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  life: number;
  age: number;
}

