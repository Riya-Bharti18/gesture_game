import './style.css';
import { Game } from './Game';
import { HandTracker } from './HandTracker';
import { SoundEffects } from './SoundEffects';
import { Point } from './types';

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const video = document.getElementById('webcam') as HTMLVideoElement;
  const cameraStatusText = document.getElementById('camera-status-text') as HTMLElement;
  const cameraDot = document.querySelector('.status-badge .dot') as HTMLElement;
  const toggleInputBtn = document.getElementById('toggle-input-btn') as HTMLButtonElement;
  const inputModeIcon = document.getElementById('input-mode-icon') as HTMLElement;
  const inputModeLabel = document.getElementById('input-mode-label') as HTMLElement;
  const toggleSoundBtn = document.getElementById('toggle-sound-btn') as HTMLButtonElement;
  const soundIcon = document.getElementById('sound-icon') as HTMLElement;

  const sound = new SoundEffects();
  const tracker = new HandTracker(video);
  const game = new Game(canvas, video, sound, tracker);

  let currentFingerPos: Point | null = null;
  let isPinchGesture = false;

  // Initialize hand tracker and video feed
  await tracker.init(
    (pos, isPinch) => {
      currentFingerPos = pos;
      isPinchGesture = isPinch ?? false;
    },
    (statusText, state) => {
      if (cameraStatusText) cameraStatusText.textContent = statusText;
      if (cameraDot) {
        cameraDot.className = `dot ${state}`;
      }
    }
  );

  // Toggle Input Mode (Hand vs Mouse)
  toggleInputBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextMode = tracker.currentInputMode === 'hand' ? 'mouse' : 'hand';
    tracker.setInputMode(nextMode);

    if (nextMode === 'hand') {
      inputModeIcon.textContent = '🖐️';
      inputModeLabel.textContent = 'Hand Tracking';
    } else {
      inputModeIcon.textContent = '🖱️';
      inputModeLabel.textContent = 'Mouse / Touch';
    }
  });

  // Toggle Sound Effects
  toggleSoundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.enabled = !sound.enabled;
    soundIcon.textContent = sound.enabled ? '🔊' : '🔇';
  });

  // Main Render Loop
  function loop() {
    game.update(currentFingerPos, isPinchGesture);
    game.draw(currentFingerPos);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
