"""
Gesture-Controlled Fruit Ninja
Slice fruits using your index finger, tracked live via webcam.

Controls:
  SPACE - start / restart
  ESC   - quit
"""

import math
import random
import time

import cv2
import mediapipe as mp
import numpy as np
import pygame

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
WIDTH, HEIGHT = 960, 720
FPS = 30

GAME_DURATION = 60          # seconds
STARTING_LIVES = 3
GRAVITY = 900                # px / s^2
SPAWN_INTERVAL_RANGE = (0.55, 1.3)
BOMB_CHANCE = 0.18

TRAIL_MAX_LEN = 10
SLICE_SPEED_THRESHOLD = 350  # px/s finger must move to count as a "slice"

FRUIT_RADIUS = 42
BOMB_RADIUS = 38

FRUIT_COLORS = [
    (220, 40, 40),    # apple
    (255, 140, 0),    # orange
    (40, 180, 90),    # watermelon-ish
    (150, 40, 190),   # grape
    (255, 210, 30),   # banana/lemon
]
BOMB_COLOR = (25, 25, 25)

WHITE = (255, 255, 255)
BLACK = (10, 10, 10)

# ---------------------------------------------------------------------------
# INIT
# ---------------------------------------------------------------------------
pygame.init()
pygame.font.init()

FONT_SM = pygame.font.SysFont("Segoe UI", 22, bold=True)
FONT_MD = pygame.font.SysFont("Segoe UI", 32, bold=True)
FONT_LG = pygame.font.SysFont("Segoe UI", 68, bold=True)

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Gesture Fruit Ninja")
clock = pygame.time.Clock()


# ---------------------------------------------------------------------------
# HAND TRACKING
# ---------------------------------------------------------------------------
class HandTracker:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5,
        )

    def get_index_tip(self, frame_rgb):
        h, w, _ = frame_rgb.shape
        results = self.hands.process(frame_rgb)
        if results.multi_hand_landmarks:
            lm = results.multi_hand_landmarks[0].landmark[8]  # index fingertip
            return int(lm.x * w), int(lm.y * h)
        return None

    def close(self):
        self.hands.close()


def frame_to_surface(frame_rgb):
    h, w, _ = frame_rgb.shape
    return pygame.image.frombuffer(frame_rgb.tobytes(), (w, h), "RGB")


# ---------------------------------------------------------------------------
# GEOMETRY HELPER
# ---------------------------------------------------------------------------
def segment_hits_circle(p1, p2, center, radius):
    x1, y1 = p1
    x2, y2 = p2
    cx, cy = center
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(cx - x1, cy - y1) <= radius
    t = max(0.0, min(1.0, ((cx - x1) * dx + (cy - y1) * dy) / length_sq))
    closest = (x1 + t * dx, y1 + t * dy)
    return math.hypot(cx - closest[0], cy - closest[1]) <= radius


# ---------------------------------------------------------------------------
# GAME OBJECTS
# ---------------------------------------------------------------------------
class Fruit:
    def __init__(self, is_bomb=False):
        self.is_bomb = is_bomb
        self.x = random.randint(90, WIDTH - 90)
        self.y = HEIGHT + 50
        self.vx = random.uniform(-110, 110)
        self.vy = -random.uniform(780, 980)
        self.radius = BOMB_RADIUS if is_bomb else FRUIT_RADIUS
        self.color = BOMB_COLOR if is_bomb else random.choice(FRUIT_COLORS)
        self.sliced = False
        self.alive = True
        self.rot = 0.0
        self.spin = random.uniform(-3, 3)

    def update(self, dt):
        self.vy += GRAVITY * dt
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.rot += self.spin * dt
        if self.y - self.radius > HEIGHT + 60:
            self.alive = False

    def draw(self, surf):
        pos = (int(self.x), int(self.y))
        if self.is_bomb:
            pygame.draw.circle(surf, self.color, pos, self.radius)
            pygame.draw.circle(surf, (210, 210, 210), pos, self.radius, 3)
            fx = int(self.x + math.cos(self.rot) * 14)
            fy = int(self.y - self.radius - 14)
            pygame.draw.line(surf, (255, 170, 0), (pos[0], pos[1] - self.radius), (fx, fy), 3)
            pygame.draw.circle(surf, (255, 210, 60), (fx, fy), 4)
        else:
            pygame.draw.circle(surf, self.color, pos, self.radius)
            hi = tuple(min(255, c + 70) for c in self.color)
            hi_pos = (int(self.x - self.radius * 0.3), int(self.y - self.radius * 0.3))
            pygame.draw.circle(surf, hi, hi_pos, int(self.radius * 0.32))


class Particle:
    def __init__(self, x, y, color):
        self.x, self.y = x, y
        angle = random.uniform(0, math.tau)
        speed = random.uniform(90, 340)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.color = color
        self.life = random.uniform(0.35, 0.75)
        self.age = 0.0
        self.radius = random.randint(3, 6)

    def update(self, dt):
        self.age += dt
        self.vy += 520 * dt
        self.x += self.vx * dt
        self.y += self.vy * dt

    def is_alive(self):
        return self.age < self.life

    def draw(self, surf):
        alpha = max(0, int(255 * (1 - self.age / self.life)))
        s = pygame.Surface((self.radius * 2, self.radius * 2), pygame.SRCALPHA)
        pygame.draw.circle(s, (*self.color, alpha), (self.radius, self.radius), self.radius)
        surf.blit(s, (self.x - self.radius, self.y - self.radius))


# ---------------------------------------------------------------------------
# UI HELPERS
# ---------------------------------------------------------------------------
def glass_panel(surf, x, y, w, h, radius=18, alpha=95):
    panel = pygame.Surface((w, h), pygame.SRCALPHA)
    pygame.draw.rect(panel, (255, 255, 255, alpha), (0, 0, w, h), border_radius=radius)
    pygame.draw.rect(panel, (255, 255, 255, 170), (0, 0, w, h), width=2, border_radius=radius)
    surf.blit(panel, (x, y))


def text_shadow(surf, text, font, color, pos, shadow_color=(0, 0, 0)):
    shadow = font.render(text, True, shadow_color)
    surf.blit(shadow, (pos[0] + 2, pos[1] + 2))
    main = font.render(text, True, color)
    surf.blit(main, pos)


# ---------------------------------------------------------------------------
# MAIN GAME
# ---------------------------------------------------------------------------
class Game:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
        self.tracker = HandTracker()
        self.reset(full=True)

    def reset(self, full=False):
        self.fruits = []
        self.particles = []
        self.trail = []  # list of (x, y, t)
        self.score = 0
        self.combo = 0
        self.combo_timer = 0.0
        self.lives = STARTING_LIVES
        self.start_time = time.time()
        self.next_spawn = time.time() + random.uniform(*SPAWN_INTERVAL_RANGE)
        self.state = "menu" if full else "playing"
        self.game_over_reason = ""

    def time_left(self):
        return max(0, GAME_DURATION - (time.time() - self.start_time))

    def spawn_fruit(self):
        is_bomb = random.random() < BOMB_CHANCE
        self.fruits.append(Fruit(is_bomb=is_bomb))
        self.next_spawn = time.time() + random.uniform(*SPAWN_INTERVAL_RANGE)

    def slice_effects(self, fruit):
        for _ in range(18):
            self.particles.append(Particle(fruit.x, fruit.y, fruit.color))

    def handle_slicing(self, dt):
        if len(self.trail) < 2:
            return
        (x1, y1, t1), (x2, y2, t2) = self.trail[-2], self.trail[-1]
        dt_move = max(t2 - t1, 1e-4)
        dist = math.hypot(x2 - x1, y2 - y1)
        speed = dist / dt_move
        if speed < SLICE_SPEED_THRESHOLD:
            return
        for fruit in self.fruits:
            if fruit.sliced or not fruit.alive:
                continue
            if segment_hits_circle((x1, y1), (x2, y2), (fruit.x, fruit.y), fruit.radius):
                fruit.sliced = True
                fruit.alive = False
                if fruit.is_bomb:
                    self.state = "gameover"
                    self.game_over_reason = "Sliced a bomb!"
                else:
                    self.combo += 1
                    self.combo_timer = 1.0
                    points = 10 * max(1, self.combo)
                    self.score += points
                    self.slice_effects(fruit)

    def update(self, dt, finger_pos):
        if self.state != "playing":
            return

        now = time.time()
        if finger_pos:
            self.trail.append((finger_pos[0], finger_pos[1], now))
            if len(self.trail) > TRAIL_MAX_LEN:
                self.trail.pop(0)
            self.handle_slicing(dt)
        else:
            self.trail.clear()

        if self.combo_timer > 0:
            self.combo_timer -= dt
            if self.combo_timer <= 0:
                self.combo = 0

        if now >= self.next_spawn:
            self.spawn_fruit()

        for fruit in self.fruits:
            fruit.update(dt)
            if not fruit.alive and not fruit.sliced and not fruit.is_bomb:
                self.lives -= 1
                if self.lives <= 0:
                    self.state = "gameover"
                    self.game_over_reason = "Out of lives!"

        self.fruits = [f for f in self.fruits if f.alive]

        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if p.is_alive()]

        if self.time_left() <= 0:
            self.state = "gameover"
            self.game_over_reason = "Time's up!"

    # ------------------------------------------------------------------
    def draw_hud(self):
        glass_panel(screen, 20, 20, 220, 60)
        text_shadow(screen, f"Score  {self.score}", FONT_MD, WHITE, (36, 34))

        glass_panel(screen, WIDTH - 240, 20, 220, 60)
        t = int(self.time_left())
        text_shadow(screen, f"Time  {t:02d}s", FONT_MD, WHITE, (WIDTH - 224, 34))

        glass_panel(screen, 20, 96, 160, 46)
        hearts = "\u2764 " * self.lives
        text_shadow(screen, hearts.strip(), FONT_SM, (255, 90, 90), (34, 108))

        if self.combo > 1:
            glass_panel(screen, WIDTH // 2 - 90, 20, 180, 50)
            text_shadow(screen, f"COMBO x{self.combo}", FONT_SM, (255, 220, 60), (WIDTH // 2 - 74, 34))

    def draw_trail(self):
        if len(self.trail) < 2:
            return
        pts = [(p[0], p[1]) for p in self.trail]
        for i in range(1, len(pts)):
            alpha = i / len(pts)
            width = max(2, int(8 * alpha))
            pygame.draw.line(screen, (255, 255, 255), pts[i - 1], pts[i], width)

    def draw_menu(self):
        glass_panel(screen, WIDTH // 2 - 260, HEIGHT // 2 - 140, 520, 280, radius=26)
        title = FONT_LG.render("FRUIT NINJA", True, WHITE)
        screen.blit(title, (WIDTH // 2 - title.get_width() // 2, HEIGHT // 2 - 110))
        sub = FONT_SM.render("Slice fruits with your index finger", True, WHITE)
        screen.blit(sub, (WIDTH // 2 - sub.get_width() // 2, HEIGHT // 2 - 30))
        prompt = FONT_MD.render("Press SPACE to start", True, (255, 220, 60))
        screen.blit(prompt, (WIDTH // 2 - prompt.get_width() // 2, HEIGHT // 2 + 30))

    def draw_gameover(self):
        glass_panel(screen, WIDTH // 2 - 260, HEIGHT // 2 - 150, 520, 300, radius=26)
        title = FONT_LG.render("GAME OVER", True, (255, 90, 90))
        screen.blit(title, (WIDTH // 2 - title.get_width() // 2, HEIGHT // 2 - 120))
        reason = FONT_SM.render(self.game_over_reason, True, WHITE)
        screen.blit(reason, (WIDTH // 2 - reason.get_width() // 2, HEIGHT // 2 - 50))
        score_txt = FONT_MD.render(f"Final Score: {self.score}", True, (255, 220, 60))
        screen.blit(score_txt, (WIDTH // 2 - score_txt.get_width() // 2, HEIGHT // 2))
        prompt = FONT_SM.render("Press SPACE to play again", True, WHITE)
        screen.blit(prompt, (WIDTH // 2 - prompt.get_width() // 2, HEIGHT // 2 + 70))

    def draw(self, cam_surface):
        screen.blit(pygame.transform.scale(cam_surface, (WIDTH, HEIGHT)), (0, 0))

        dim = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        dim.fill((0, 0, 0, 40))
        screen.blit(dim, (0, 0))

        for fruit in self.fruits:
            fruit.draw(screen)
        for p in self.particles:
            p.draw(screen)

        self.draw_trail()

        if self.state == "menu":
            self.draw_menu()
        elif self.state == "playing":
            self.draw_hud()
        elif self.state == "gameover":
            self.draw_hud()
            self.draw_gameover()

        pygame.display.flip()

    # ------------------------------------------------------------------
    def run(self):
        running = True
        prev_time = time.time()

        while running:
            now = time.time()
            dt = min(now - prev_time, 0.05)
            prev_time = now

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_SPACE and self.state in ("menu", "gameover"):
                        self.reset(full=False)

            ok, frame = self.cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            cam_surface = frame_to_surface(frame_rgb)

            finger_pos = self.tracker.get_index_tip(frame_rgb)
            if finger_pos:
                fx = int(finger_pos[0] * WIDTH / frame_rgb.shape[1])
                fy = int(finger_pos[1] * HEIGHT / frame_rgb.shape[0])
                finger_pos = (fx, fy)

            self.update(dt, finger_pos)
            self.draw(cam_surface)
            clock.tick(FPS)

        self.cap.release()
        self.tracker.close()
        pygame.quit()


if __name__ == "__main__":
    Game().run()