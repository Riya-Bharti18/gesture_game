# Gesture-Controlled Fruit Ninja

Slice fruits in real time using nothing but your index finger and a webcam.

## How it works
- **OpenCV** captures your webcam feed frame by frame.
- **MediaPipe Hands** detects your hand and locates the index fingertip (landmark 8) in each frame.
- **Pygame** renders the game: the webcam feed as the background, with fruits, bombs, particles, and a glassmorphism-style UI drawn on top.
- A **slice** is detected when your fingertip moves fast enough that the line segment between its last two positions crosses a fruit's hitbox (this is a real swipe check, not just touch-detection, so slow hovering won't trigger it).

## Setup

1. Make sure you have Python 3.9–3.11 installed (MediaPipe doesn't yet support the very latest Python versions — check MediaPipe's docs if you hit install issues).
2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the game:
   ```bash
   python main.py
   ```

## Controls
- **SPACE** — start the game / restart after game over
- **ESC** — quit
- Move your **index finger** in front of the webcam to slice fruit. Swipe fast — slow movements won't register as slices (matches real Fruit Ninja feel).

## Game rules
- 3 lives. Let a fruit fall off-screen without slicing it → lose a life.
- Slicing a **bomb** ends the game instantly.
- 60-second timer. Survive and score as much as you can before it runs out.
- Combo system: slicing fruits in quick succession (within 1 second of each other) increases your combo multiplier and score per fruit.

## Tuning
All the key constants live at the top of `main.py`:
- `SLICE_SPEED_THRESHOLD` — how fast your finger must move to count as a slice (lower = more forgiving)
- `BOMB_CHANCE` — probability each spawn is a bomb
- `GAME_DURATION`, `STARTING_LIVES` — difficulty knobs
- `FRUIT_COLORS`, `FRUIT_RADIUS` — visuals

## Troubleshooting
- **Camera not opening**: try changing `cv2.VideoCapture(0)` to `cv2.VideoCapture(1)` in `Game.__init__` if you have multiple cameras.
- **Low FPS / laggy tracking**: lower `WIDTH`/`HEIGHT` at the top of `main.py`, or reduce `max_num_hands`/confidence thresholds are already tuned for speed.
- **MediaPipe install fails**: MediaPipe wheels lag behind new Python releases — use Python 3.10 or 3.11 if 3.12+ fails.