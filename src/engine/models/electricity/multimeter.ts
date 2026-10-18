/**
 * Digital multimeters.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';
import { CanvasPanel, drawBezel, drawLcdDigits } from '../../CanvasPanel';

/**
 * A digital multimeter — the modern companion to the moving-coil meter.
 * Shows a live LCD face and has a selector dial.
 */
export class MultimeterModel {
  readonly group = new THREE.Group();
  #panel = new CanvasPanel(512, 256);
  #displayValue = 0;
  #displayUnit = 'V';
  #mode = 'DC V';

  constructor() {
    this.group.name = 'Multimeter';

    const width = 0.086;
    const height = 0.17;
    const depth = 0.03;
    const body = meshOf(roundedBox(width, height, depth, 0.008), Materials.paint('#d9a02b', 0.45), 'Body');
    body.rotation.x = -Math.PI / 2 - THREE.MathUtils.degToRad(12);
    body.position.set(0, height / 2, depth * 0.12);
    this.group.add(body);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.72, height * 0.24), this.#panel.material());
    screen.name = 'Lcd';
    screen.rotation.x = -THREE.MathUtils.degToRad(12);
    screen.position.set(0, height * 0.8, depth / 2 + 0.0015);
    this.group.add(screen);

    const dial = meshOf(new THREE.CylinderGeometry(width * 0.24, width * 0.24, 0.008, 28), Materials.paint('#2b2f33', 0.5), 'Dial');
    dial.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(12);
    dial.position.set(0, height * 0.53, depth / 2 + 0.002);
    this.group.add(dial);

    const marker = meshOf(new THREE.BoxGeometry(0.002, width * 0.2, 0.003), Materials.paint('#e8e3d6', 0.4), 'DialMarker');
    marker.rotation.x = -THREE.MathUtils.degToRad(12);
    marker.position.set(0, height * 0.45, depth / 2 + 0.006);
    this.group.add(marker);

    const socketGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.004, 14);
    for (const [i, colour] of ['#1f2226', '#c0392b', '#c0392b'].entries()) {
      const socket = meshOf(socketGeometry, Materials.paint(colour, 0.5), 'Socket');
      socket.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(12);
      socket.position.set((i - 1) * width * 0.28, height * 0.1, depth / 2 + 0.002);
      this.group.add(socket);
    }

    this.setReading(0, 'V', 'DC V');
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'multimeter', label: 'Digital multimeter' };
  }

  setReading(value: number, unit: string, mode: string): void {
    this.#displayValue = value;
    this.#displayUnit = unit;
    this.#mode = mode;
    this.#panel.update((ctx, w, h) => {
      drawBezel(ctx, w, h, { radius: 14, fill: '#a8b8a0', inset: 'rgba(255,255,255,0.5)' });
      ctx.fillStyle = 'rgba(20,30,20,0.35)';
      ctx.font = `${Math.round(h * 0.16)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.#mode, w * 0.07, h * 0.22);
      drawLcdDigits(ctx, value.toFixed(2), {
        x: w * 0.5,
        y: h * 0.62,
        size: h * 0.42,
        align: 'center',
      });
      ctx.font = `bold ${Math.round(h * 0.2)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(this.#displayUnit, w * 0.95, h * 0.62);
    });
  }

  get reading(): { value: number; unit: string; mode: string } {
    return { value: this.#displayValue, unit: this.#displayUnit, mode: this.#mode };
  }
}
