/**
 * A bench d.c. power supply.
 *
 * The kind every school lab has: a grey box, a green LCD showing volts and
 * amps, a chunky voltage knob, a rocker switch and two 4 mm sockets. The screen
 * dims when the output is off, which is the visual cue the thermal practical
 * uses to show that the heater is energised.
 */

import * as THREE from 'three';
import { meshOf, roundedBox } from '../../../geometry';
import { Materials } from '../../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from '../types';

export interface PowerSupplyOptions extends ModelDisplayOptions {
  /** Voltage shown on the display. */
  voltageV?: number;
  /** Current shown on the display. */
  currentA?: number;
  /** Start with the output on. */
  on?: boolean;
}

export interface PowerSupplyView {
  setOutput(on: boolean): void;
  readonly on: boolean;
}

export function buildPowerSupply(options: PowerSupplyOptions = {}): THREE.Group {
  const { voltageV = 12, currentA = 3.5, on = false } = options;
  const group = new THREE.Group();
  group.name = 'PowerSupply';

  const width = 0.22;
  const height = 0.11;
  const depth = 0.17;
  const baseY = 0.008;
  const faceZ = depth / 2 + 0.007;

  const body = meshOf(roundedBox(width, height, depth, 0.012), Materials.paint('#3b424a', 0.5), 'Body');
  body.position.y = baseY + height / 2;
  group.add(body);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = meshOf(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 12), Materials.rubber(), 'Foot');
      foot.position.set(sx * 0.075, 0.004, sz * 0.06);
      group.add(foot);
    }
  }

  // Vent slots on the lid.
  for (let index = 0; index < 6; index += 1) {
    const slot = meshOf(
      new THREE.BoxGeometry(0.13, 0.002, 0.006),
      Materials.paint('#171b1f', 0.8),
      'Vent',
    );
    slot.position.set(0, baseY + height + 0.001, -0.045 + index * 0.018);
    group.add(slot);
  }

  // The front panel. Its texture is redrawn whenever the output changes.
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const drawPanel = (isOn: boolean): void => {
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#363d45');
    gradient.addColorStop(1, '#272d34');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#4a535d';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 248);

    ctx.fillStyle = '#d7e0ea';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('D.C. POWER SUPPLY', 22, 48);
    ctx.fillStyle = '#8d99a6';
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('0 – 15 V     0 – 5 A', 22, 76);

    ctx.fillStyle = '#08130c';
    ctx.fillRect(300, 18, 190, 96);
    ctx.strokeStyle = '#141d16';
    ctx.lineWidth = 3;
    ctx.strokeRect(300, 18, 190, 96);

    ctx.fillStyle = isOn ? '#7dff9b' : '#1d5330';
    ctx.shadowColor = isOn ? 'rgba(90, 255, 130, 0.55)' : 'transparent';
    ctx.shadowBlur = isOn ? 12 : 0;
    ctx.font = 'bold 40px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(voltageV.toFixed(1), 452, 58);
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.fillText('V', 482, 58);
    ctx.font = 'bold 30px Consolas, monospace';
    ctx.fillText(currentA.toFixed(2), 452, 100);
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.fillText('A', 482, 100);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#7f8a96';
    ctx.font = '15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OUTPUT', 22, 232);
    ctx.fillText(isOn ? 'ON' : 'OFF', 452, 232);
    texture.needsUpdate = true;
  };
  drawPanel(on);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.195, 0.0975),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0.15 }),
  );
  panel.name = 'LabelPanel';
  panel.position.set(0, baseY + 0.057, faceZ);
  group.add(panel);

  // Voltage knob.
  const knob = meshOf(
    new THREE.CylinderGeometry(0.015, 0.016, 0.014, 24),
    Materials.paint('#1c2025', 0.45),
    'Knob',
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(-0.074, baseY + 0.036, faceZ + 0.007);
  group.add(knob);
  const pointer = meshOf(
    new THREE.BoxGeometry(0.003, 0.011, 0.002),
    Materials.paint('#e8e3d6', 0.35),
    'KnobPointer',
  );
  pointer.position.set(-0.074, baseY + 0.047, faceZ + 0.014);
  group.add(pointer);

  // Output sockets.
  const socketGeometry = new THREE.CylinderGeometry(0.0065, 0.0065, 0.018, 16);
  for (const [sx, colour] of [
    [-0.045, '#c0392b'],
    [0.045, '#1f2226'],
  ] as const) {
    const socket = meshOf(socketGeometry, Materials.agedBrass(), 'Socket');
    socket.rotation.x = Math.PI / 2;
    socket.position.set(sx, baseY + 0.024, faceZ + 0.008);
    group.add(socket);
    const ring = meshOf(
      new THREE.TorusGeometry(0.0075, 0.002, 8, 18),
      Materials.paint(colour, 0.45),
      'SocketRing',
    );
    ring.position.set(sx, baseY + 0.024, faceZ + 0.017);
    group.add(ring);
  }

  // Rocker switch.
  const switchBody = meshOf(
    roundedBox(0.026, 0.013, 0.012, 0.003),
    Materials.paint('#1c2025', 0.45),
    'Rocker',
  );
  switchBody.position.set(0.0, baseY + 0.042, faceZ + 0.005);
  group.add(switchBody);

  // Output LED.
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a1010,
    emissive: new THREE.Color('#ff3b2f'),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const led = meshOf(new THREE.SphereGeometry(0.0038, 12, 10), ledMaterial, 'Led');
  led.position.set(0.09, baseY + 0.042, faceZ + 0.004);
  group.add(led);

  let outputOn = on;
  const view: PowerSupplyView = {
    setOutput(next: boolean): void {
      outputOn = next;
      drawPanel(next);
      ledMaterial.emissiveIntensity = next ? 1.6 : 0;
      ledMaterial.color.set(next ? '#ff5a4a' : '#5a1010');
    },
    get on() {
      return outputOn;
    },
  };
  view.setOutput(on);

  group.userData.supply = view;
  group.userData.model = { id: 'apparatus-power-supply', label: 'Power supply' };
  group.userData.facts = [
    'A bench supply holds the voltage steady while the current changes with the load.',
    'The display shows the terminal p.d. and the current the circuit is drawing.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const POWER_SUPPLY_MODEL: ModelEntry = {
  id: 'apparatus-power-supply',
  label: 'Power supply',
  category: 'apparatus',
  summary: 'A variable d.c. supply with a green LCD and 4 mm output sockets.',
  facts: ['Set the voltage before connecting the load; check the polarity.'],
  build: (options) => buildPowerSupply(options),
};
