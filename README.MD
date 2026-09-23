# Gesture-Controlled Fruit Ninja — TypeScript Edition

A modern, high-performance web-based Fruit Ninja game built with **TypeScript**, **Vite**, **HTML5 Canvas**, **MediaPipe Hands JS API**, and **Web Audio API**.

Slice fruits in real time using your index finger in front of your webcam, or switch seamlessly to mouse/touch mode!

---

## 🌟 Key Features

- **TypeScript Engine**: Fully typed modular code base with strict compilation and zero runtime type errors.
- **Real-Time Hand Tracking**: Uses MediaPipe Hands JS API to detect and track index fingertip gestures mapped directly onto a mirrored webcam stream.
- **Mouse & Touch Fallback**: Instant toggle button allowing input via mouse cursor or touchscreen if camera is offline or unavailable.
- **Procedural Sound Engine**: Web Audio API synthesizer for blade swooshes, fruit slice snaps, bomb explosions, combo chimes, and UI pop effects with zero external audio assets.
- **Glassmorphism UI**: Glowing, dark-themed UI built with HTML5 Canvas and CSS backdrop filters.
- **Juicy Physics & Slice Effects**:
  - Fruits split into separate rotating halves that fly apart upon slicing.
  - Fruit juice particle splatters & bomb fuse spark generators.
  - Glowing multi-color slice trails following finger/mouse swipes.
  - High score persistence with `localStorage`.

---


## 🎮 Game Controls & Rules

- **SPACE / Click Screen** — Start game / Restart after Game Over.
- **Hand Gesture** — Move index finger in front of webcam to slice fruit. Swipe fast for slices to register.
- **Input Mode Toggle (Top Right)** — Switch between 🖐️ Hand Tracking and 🖱️ Mouse/Touch Slicing.
- **Sound Toggle (Top Right)** — Mute or enable sound effects.

### Rules
- **3 Lives**: Let a fruit drop off-screen without slicing it = lose 1 life.
- **Bombs**: Slicing a bomb detonates it and triggers instant Game Over!
- **60 Second Timer**: Score as many points as possible before time runs out.
- **Combos**: Slice multiple fruits rapidly within 1 second to build combo multipliers and score extra points!

---

## 🛠️ Project Architecture

```
gesture_game/
├── index.html              # HTML5 entry point & glass UI elements
├── package.json            # Dependencies & build scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build config
├── src/
│   ├── main.ts             # Application bootstrapper & loop
│   ├── Game.ts             # Core game engine & state manager
│   ├── HandTracker.ts      # MediaPipe webcam gesture tracking
│   ├── Fruit.ts            # Fruit & Bomb entity physics & rendering
│   ├── Particle.ts         # Juice splatter & spark particle engine
│   ├── SoundEffects.ts     # Web Audio API sound synthesizer
│   ├── types.ts            # TypeScript interface definitions
│   └── style.css           # Glassmorphism styling & layout
└── dist/                   # Production build output
```
