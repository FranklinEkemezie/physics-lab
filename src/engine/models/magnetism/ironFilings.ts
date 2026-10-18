/**
 * Iron filings cards.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';

/**
 * A card of iron filings showing the field pattern around a magnet. The
 * pattern is generated from the actual dipole field, then drawn as a texture
 * — so the "filings" line up with the physics rather than being decoration.
 */
export function buildIronFilingsCard(options: { sizeM?: number; dipoles?: { x: number; z: number }[] } = {}): THREE.Group {
  const { sizeM = 0.16, dipoles = [{ x: 0, z: 0 }] } = options;
  const group = new THREE.Group();
  group.name = 'IronFilingsCard';

  const card = meshOf(roundedBox(sizeM, 0.002, sizeM * 0.75, 0.002), Materials.paint('#f2efe4', 0.9), 'Card');
  card.position.y = 0.001;
  group.add(card);

  const resolution = 384;
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f6f3e8';
    ctx.fillRect(0, 0, resolution, resolution);
    ctx.fillStyle = 'rgba(45,45,50,0.75)';

    // Streamline tracing through the summed dipole field.
    const field = (x: number, z: number): [number, number] => {
      let fx = 0;
      let fz = 0;
      for (const dipole of dipoles) {
        const dx = x - dipole.x;
        const dz = z - dipole.z;
        const r2 = dx * dx + dz * dz + 1e-4;
        const r = Math.sqrt(r2);
        // Field of an ideal dipole lying along +x.
        const dot = dx; // dipole axis = x
        fx += (3 * dot * dx) / (r ** 5) - 1 / (r ** 3);
        fz += (3 * dot * dz) / (r ** 5);
      }
      return [fx, fz];
    };

    const half = sizeM / 2;
    const toPixel = (v: number): number => ((v + half) / sizeM) * resolution;

    for (let i = 0; i < 900; i += 1) {
      // Start filaments evenly around each dipole.
      const dipole = dipoles[i % dipoles.length];
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.008 + Math.random() * 0.05;
      let x = dipole.x + Math.cos(angle) * radius;
      let z = dipole.z + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(toPixel(x), toPixel(z));
      for (let step = 0; step < 260; step += 1) {
        const [fx, fz] = field(x, z);
        const magnitude = Math.hypot(fx, fz) + 1e-9;
        const stepSize = 0.0009;
        x += (fx / magnitude) * stepSize;
        z += (fz / magnitude) * stepSize;
        if (Math.abs(x) > half || Math.abs(z) > half * 0.75) break;
        ctx.lineTo(toPixel(x), toPixel(z));
      }
      ctx.strokeStyle = `rgba(40,40,46,${0.25 + Math.random() * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const filings = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeM * 0.98, sizeM * 0.73),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  filings.name = 'Filings';
  filings.rotation.x = -Math.PI / 2;
  filings.position.y = 0.0021;
  group.add(filings);

  group.userData.isHandle = true;
  group.userData.apparatus = { id: 'iron-filings', label: 'Iron filings card' };
  return group;
}
