import { HandResults, InputMode, Point } from './types';
import * as MediaPipeHands from '@mediapipe/hands';
import * as MediaPipeCamera from '@mediapipe/camera_utils';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export class HandTracker {
  private videoElement: HTMLVideoElement;
  private handsInstance: any = null;
  private cameraInstance: any = null;
  private onPosUpdateCallback: ((pos: Point | null, isPinch?: boolean) => void) | null = null;
  private onStatusUpdateCallback: ((status: string, state: 'green' | 'yellow' | 'red') => void) | null = null;

  public currentInputMode: InputMode = 'hand';
  public isCameraReady = false;

  // Smoothing position filter
  private smoothedPos: { x: number; y: number } | null = null;
  private readonly smoothAlpha = 0.45; // EMA factor for silky smooth gesture motion

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  public async init(
    onPosUpdate: (pos: Point | null, isPinch?: boolean) => void,
    onStatusUpdate: (status: string, state: 'green' | 'yellow' | 'red') => void
  ): Promise<void> {
    this.onPosUpdateCallback = onPosUpdate;
    this.onStatusUpdateCallback = onStatusUpdate;

    try {
      this.onStatusUpdateCallback('Requesting Camera...', 'yellow');

      // Use CDN global or NPM module instance
      const HandsClass = window.Hands || MediaPipeHands.Hands;
      if (!HandsClass) {
        throw new Error('MediaPipe Hands class is missing');
      }

      this.handsInstance = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      this.handsInstance.onResults((results: HandResults) => {
        if (this.currentInputMode !== 'hand') return;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          const indexTip = landmarks[8]; // Landmark 8 = Index Fingertip
          const thumbTip = landmarks[4]; // Landmark 4 = Thumb Tip

          // Mirror X because camera view is horizontally mirrored for natural gameplay
          const rawX = (1 - indexTip.x) * 960;
          const rawY = indexTip.y * 720;

          // Apply Exponential Moving Average (EMA) position filter
          if (!this.smoothedPos) {
            this.smoothedPos = { x: rawX, y: rawY };
          } else {
            this.smoothedPos.x = this.smoothedPos.x * (1 - this.smoothAlpha) + rawX * this.smoothAlpha;
            this.smoothedPos.y = this.smoothedPos.y * (1 - this.smoothAlpha) + rawY * this.smoothAlpha;
          }

          // Check Pinch Gesture (Thumb Tip to Index Tip distance)
          const thumbX = (1 - thumbTip.x) * 960;
          const thumbY = thumbTip.y * 720;
          const pinchDist = Math.hypot(thumbX - this.smoothedPos.x, thumbY - this.smoothedPos.y);
          const isPinch = pinchDist < 45;

          if (this.onPosUpdateCallback) {
            this.onPosUpdateCallback(
              { x: this.smoothedPos.x, y: this.smoothedPos.y, t: performance.now() / 1000 },
              isPinch
            );
          }
        } else {
          this.smoothedPos = null;
          if (this.onPosUpdateCallback) {
            this.onPosUpdateCallback(null, false);
          }
        }
      });

      // Request User Webcam Stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 720, facingMode: 'user' },
      });

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      // Camera Loop helper
      const CameraClass = window.Camera || MediaPipeCamera.Camera;
      if (CameraClass) {
        this.cameraInstance = new CameraClass(this.videoElement, {
          onFrame: async () => {
            if (this.currentInputMode === 'hand') {
              await this.handsInstance.send({ image: this.videoElement });
            }
          },
          width: 960,
          height: 720,
        });
        await this.cameraInstance.start();
      }

      this.isCameraReady = true;
      this.onStatusUpdateCallback('Hand Tracking Active', 'green');
    } catch (err: any) {
      console.warn('Webcam / MediaPipe setup notice:', err);
      this.onStatusUpdateCallback('Camera Offline (Mouse/Touch Active)', 'yellow');
      this.currentInputMode = 'mouse';
    }
  }

  public setInputMode(mode: InputMode): void {
    this.currentInputMode = mode;
    if (this.onStatusUpdateCallback) {
      if (mode === 'mouse') {
        this.onStatusUpdateCallback('Mouse/Touch Mode Active', 'green');
      } else if (this.isCameraReady) {
        this.onStatusUpdateCallback('Hand Tracking Active', 'green');
      } else {
        this.onStatusUpdateCallback('Camera Unavailable (Mouse Mode)', 'red');
      }
    }
  }

  public getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }
}
