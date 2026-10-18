/**
 * Digital stopwatch, accurate to 0.01 s.
 *
 * The 3D model is a *view* of the timing state; the state itself lives in the
 * experiment's clock (see `src/physics/Stopwatch.ts`). Keeping them separate
 * means the physics never depends on rendering.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { meshOf, roundedBox } from '../geometry';
import { CanvasPanel, drawBezel, drawLcdDigits } from '../CanvasPanel';

export interface StopwatchView {
  group: THREE.Group;
  /** Redraw the LCD. Called only when the displayed time changes. */
  setDisplay(seconds: number, options?: { running?: boolean; hundredths?: boolean }): void;
  /** Draw attention to a button press. */
  flashButton(button: 'start' | 'reset' | 'mode'): void;
  /** Per-frame update for the button flash animation. */
  update(dt: number): void;
}

/** Format seconds as `mm:ss.cc` (or `s.cc` for short times). */
export function formatStopwatchTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe - minutes * 60;
  const ss = secs.toFixed(2).padStart(5, '0');
  if (minutes > 0) return `${String(minutes).padStart(2, '0')}:${ss}`;
  return ss;
}

export function buildStopwatch(): StopwatchView {
  const group = new THREE.Group();
  group.name = 'Stopwatch';

  const width = 0.068;
  const height = 0.078;
  const depth = 0.016;

  const shell = meshOf(roundedBox(width, height, depth, 0.006), Materials.paint('#1f2226', 0.42), 'Shell');
  shell.rotation.x = Math.PI / 2; // lie it flat so the face points up (+Y)
  shell.position.y = 0.008;
  group.add(shell);

  // Lanyard loop at the top — the only way to keep hold of these things.
  const loop = meshOf(new THREE.TorusGeometry(0.007, 0.0022, 10, 24), Materials.paint('#1f2226', 0.42), 'Loop');
  loop.position.set(0, 0.008, -height / 2 + 0.002);
  loop.rotation.y = Math.PI / 2;
  group.add(loop);

  // ---- LCD --------------------------------------------------------------
  const panel = new CanvasPanel(512, 256);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, height * 0.44), panel.material());
  screen.name = 'LcdScreen';
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, depth * 0.5 + 0.0011, -height * 0.09);
  group.add(screen);

  // ---- Buttons ----------------------------------------------------------
  const buttonGeometry = new THREE.CylinderGeometry(0.0062, 0.0062, 0.0045, 20);
  const buttons: Record<'mode' | 'start' | 'reset', THREE.Mesh> = {
    mode: meshOf(buttonGeometry, Materials.paint('#5a6068', 0.4), 'ButtonMode'),
    start: meshOf(buttonGeometry, Materials.paint('#c0392b', 0.4), 'ButtonStart'),
    reset: meshOf(buttonGeometry, Materials.paint('#d9a02b', 0.4), 'ButtonReset'),
  };
  const positions: [keyof typeof buttons, number][] = [
    ['mode', -0.021],
    ['start', 0],
    ['reset', 0.021],
  ];
  for (const [key, x] of positions) {
    const button = buttons[key];
    button.position.set(x, depth * 0.5 - 0.0005, height * 0.26);
    group.add(button);
  }

  const flash = { mode: 0, start: 0, reset: 0 };
  const baseColors: Record<string, THREE.Color> = {
    mode: new THREE.Color('#5a6068'),
    start: new THREE.Color('#c0392b'),
    reset: new THREE.Color('#d9a02b'),
  };

  const redraw = (seconds: number, running: boolean): void => {
    panel.update((ctx, w, h) => {
      drawBezel(ctx, w, h, { radius: 24, fill: '#9fae97', inset: 'rgba(255,255,255,0.5)' });
      ctx.fillStyle = 'rgba(30,40,30,0.12)';
      ctx.beginPath();
      ctx.roundRect(w * 0.05, h * 0.18, w * 0.9, h * 0.62, 16);
      ctx.fill();

      drawLcdDigits(ctx, formatStopwatchTime(seconds), {
        x: w / 2,
        y: h * 0.5,
        size: h * 0.42,
        letterSpacing: w * 0.014,
      });

      // Small "timing" indicator in the corner.
      ctx.fillStyle = running ? '#8a1c1c' : 'rgba(20,30,20,0.25)';
      ctx.beginPath();
      ctx.arc(w * 0.1, h * 0.14, h * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  redraw(0, false);

  return {
    group,
    setDisplay(seconds, options = {}) {
      redraw(seconds, options.running ?? false);
    },
    flashButton(button) {
      flash[button] = 1;
    },
    update(dt) {
      for (const key of Object.keys(flash) as (keyof typeof flash)[]) {
        if (flash[key] <= 0) continue;
        flash[key] = Math.max(0, flash[key] - dt * 4);
        const mesh = buttons[key];
        const material = mesh.material as THREE.MeshStandardMaterial;
        // Materials are memoised/shared, so tint a *clone* per press.
        if (!mesh.userData.clonedMaterial) {
          material.clone();
          mesh.material = material.clone();
          mesh.userData.clonedMaterial = true;
        }
        (mesh.material as THREE.MeshStandardMaterial).color
          .copy(baseColors[key])
          .lerp(new THREE.Color(0xffffff), flash[key] * 0.6);
      }
    },
  };
}
