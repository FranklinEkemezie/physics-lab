/**
 * Magnetism apparatus: bar magnets, horseshoe magnets, plotting compasses,
 * solenoids and iron-filing cards.
 *
 * A `PlottingCompass` will point wherever the local field says it should, so
 * an experiment can place one in a field and read the deflection.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { helixGeometry, makeLabelPlane, meshOf, roundedBox } from '../geometry';

/**
 * The classic painted bar magnet: red north half, blue south half, with the
 * poles stamped on. Ships with a soft-iron keeper — the bit everyone loses.
 */
export function buildBarMagnet(lengthM = 0.1, options: { withKeeper?: boolean } = {}): THREE.Group {
  const { withKeeper = true } = options;
  const group = new THREE.Group();
  group.name = 'BarMagnet';

  const width = 0.014;
  const height = 0.007;

  const north = meshOf(new THREE.BoxGeometry(lengthM / 2, height, width), Materials.paint('#b3251e', 0.42), 'NorthHalf');
  north.position.set(lengthM / 4, height / 2, 0);
  const south = meshOf(new THREE.BoxGeometry(lengthM / 2, height, width), Materials.paint('#1f3f8f', 0.42), 'SouthHalf');
  south.position.set(-lengthM / 4, height / 2, 0);
  group.add(north, south);

  for (const [name, x, colour] of [
    ['NorthPole', lengthM / 2 - 0.01, '#f7e9c8'],
    ['SouthPole', -lengthM / 2 + 0.01, '#e8eefc'],
  ] as const) {
    const letter = makeLabelPlane({
      text: name.startsWith('North') ? 'N' : 'S',
      widthM: 0.008,
      fontScale: 0.5,
      foreground: colour,
    });
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(x, height + 0.0004, 0);
    letter.name = name;
    group.add(letter);
  }

  const pivotAnchor = new THREE.Object3D();
  pivotAnchor.name = 'Centre';
  pivotAnchor.position.set(0, height / 2, 0);
  group.add(pivotAnchor);

  if (withKeeper) {
    group.userData.keeperName = 'Keeper';
  }

  group.userData.isHandle = true;
  group.userData.physics = {
    kind: 'magnet',
    lengthM,
    /** Magnetic moment in A·m², roughly right for a school bar magnet. */
    momentAm2: 1.2,
  };
  group.userData.apparatus = { id: 'bar-magnet', label: 'Bar magnet' };
  return group;
}

/** A soft-iron keeper bar that clips across the poles when stored. */
export function buildKeeper(lengthM = 0.032): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Keeper';
  const bar = meshOf(roundedBox(lengthM, 0.009, 0.016, 0.002), Materials.softIron(), 'KeeperBar');
  bar.position.y = 0.0045;
  group.add(bar);
  group.userData.physics = { kind: 'keeper' };
  return group;
}

/**
 * Horseshoe (U-shaped) magnet, built by extruding the arc of an annulus.
 *
 * <b>Anchors:</b> `PoleN`, `PoleS`.
 */
export function buildHorseshoeMagnet(options: { outerRadiusM?: number; gapM?: number; thicknessM?: number } = {}): THREE.Group {
  const { outerRadiusM = 0.032, gapM = 0.018, thicknessM = 0.012 } = options;
  const group = new THREE.Group();
  group.name = 'HorseshoeMagnet';

  const innerRadius = gapM / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadiusM, 0, Math.PI, false);
  shape.absarc(0, 0, innerRadius, Math.PI, 0, true);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
  const body = new THREE.Mesh(geometry, Materials.paint('#8e2b22', 0.45));
  body.name = 'HorseshoeBody';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Silver pole faces at the two ends.
  const poleGeometry = new THREE.BoxGeometry(innerRadius + 0.006, 0.006, thicknessM * 1.01);
  for (const [name, x] of [
    ['PoleN', -(innerRadius + 0.003)],
    ['PoleS', innerRadius + 0.003],
  ] as const) {
    const pole = meshOf(poleGeometry, Materials.softIron(), name);
    pole.position.set(x * 0.5, 0.003, thicknessM / 2);
    group.add(pole);
  }

  const poleN = new THREE.Object3D();
  poleN.name = 'PoleN';
  poleN.position.set(-(outerRadiusM + innerRadius) / 2, 0, thicknessM / 2);
  const poleS = new THREE.Object3D();
  poleS.name = 'PoleS';
  poleS.position.set((outerRadiusM + innerRadius) / 2, 0, thicknessM / 2);
  group.add(poleN, poleS);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'magnet', momentAm2: 0.9 };
  group.userData.apparatus = { id: 'horseshoe-magnet', label: 'Horseshoe magnet' };
  return group;
}

/**
 * A plotting compass: a magnetised needle on a brass pivot inside a glass
 * case. Call {@link PlottingCompassModel#setHeading} with the local field
 * direction and the needle swings round to follow it.
 */
export class PlottingCompassModel {
  readonly group = new THREE.Group();
  #needle: THREE.Group;
  #targetHeading = 0;
  #heading = 0;

  constructor(radiusM = 0.011) {
    this.group.name = 'PlottingCompass';

    const caseMesh = meshOf(new THREE.CylinderGeometry(radiusM, radiusM, 0.004, 32), Materials.paint('#2b2f33', 0.5), 'Case');
    caseMesh.position.y = 0.002;
    this.group.add(caseMesh);

    const card = new THREE.Mesh(
      new THREE.CircleGeometry(radiusM * 0.94, 40),
      new THREE.MeshStandardMaterial({ color: 0xf6f2e4, roughness: 0.85 }),
    );
    card.rotation.x = -Math.PI / 2;
    card.position.y = 0.0042;
    card.name = 'Card';
    this.group.add(card);

    // Cardinal marks, drawn as small dark ticks round the card.
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const isMajor = i % 4 === 0;
      const tick = meshOf(
        new THREE.BoxGeometry(0.0003, 0.0004, isMajor ? radiusM * 0.22 : radiusM * 0.12),
        Materials.blackSteel(),
        'Tick',
      );
      tick.position.set(Math.sin(angle) * radiusM * 0.8, 0.0046, Math.cos(angle) * radiusM * 0.8);
      tick.rotation.y = angle;
      tick.castShadow = false;
      this.group.add(tick);
    }

    const letterN = makeLabelPlane({ text: 'N', widthM: radiusM * 0.5, fontScale: 0.6, foreground: '#b3251e' });
    letterN.rotation.x = -Math.PI / 2;
    letterN.position.set(0, 0.0048, -radiusM * 0.46);
    this.group.add(letterN);

    // The needle itself: an arrow of two differently coloured halves.
    this.#needle = new THREE.Group();
    this.#needle.name = 'Needle';
    this.#needle.position.y = 0.0058;

    const needleLength = radiusM * 0.86;
    const half = new THREE.Shape();
    half.moveTo(0, 0);
    half.lineTo(needleLength, 0);
    half.lineTo(needleLength * 0.82, 0.0012);
    half.lineTo(0.06, 0.0012);
    half.closePath();
    // ExtrudeGeometry builds in XY; rotate so the needle lies flat, pointing +Z.
    const northHalfGeometry = new THREE.ExtrudeGeometry(half, { depth: 0.0006, bevelEnabled: false });
    northHalfGeometry.rotateX(Math.PI / 2);
    northHalfGeometry.rotateY(Math.PI / 2);

    const northHalf = new THREE.Mesh(northHalfGeometry, Materials.paint('#b3251e', 0.4));
    northHalf.castShadow = false;
    const southHalf = northHalf.clone();
    southHalf.material = Materials.paint('#28303a', 0.4);
    southHalf.rotation.y = Math.PI;
    this.#needle.add(northHalf, southHalf);

    const hub = meshOf(new THREE.CylinderGeometry(0.0012, 0.0012, 0.003, 12), Materials.brass(), 'Hub');
    this.#needle.add(hub);
    this.group.add(this.#needle);

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusM * 0.98, radiusM * 0.98, 0.003, 32, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        transmission: 0.9,
        roughness: 0.03,
        side: THREE.DoubleSide,
      }),
    );
    glass.name = 'Glass';
    glass.position.y = 0.0055;
    this.group.add(glass);

    this.group.userData.isHandle = true;
    this.group.userData.physics = { kind: 'compass' };
    this.group.userData.apparatus = { id: 'plotting-compass', label: 'Plotting compass' };
  }

  /**
   * Point the needle along a magnetic bearing.
   * @param radians 0 = pointing away from the camera (+Z), increasing clockwise.
   */
  setHeading(radians: number, immediate = false): void {
    this.#targetHeading = radians;
    if (immediate) {
      this.#heading = radians;
      this.#needle.rotation.y = radians;
    }
  }

  get heading(): number {
    return this.#heading;
  }

  /** Damped swing towards the field direction. */
  update(dt: number): void {
    let delta = this.#targetHeading - this.#heading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.#heading += delta * Math.min(1, dt * 6);
    this.#needle.rotation.y = this.#heading;
  }
}

/**
 * A solenoid: a long coil wound on a cardboard/delft former with terminals,
 * plus an optional soft-iron core that can be slid in and out.
 *
 * <b>Anchors:</b> `CoreSlot`.
 */
export class SolenoidModel {
  readonly group = new THREE.Group();
  #core: THREE.Mesh | null = null;
  #current = 0;

  constructor(options: { lengthM?: number; radiusM?: number; turns?: number } = {}) {
    const { lengthM = 0.14, radiusM = 0.013, turns = 120 } = options;
    this.group.name = 'Solenoid';

    const former = meshOf(
      new THREE.CylinderGeometry(radiusM, radiusM, lengthM, 28, 1, true),
      Materials.paint('#b98f5a', 0.9),
      'Former',
    );
    former.rotation.z = Math.PI / 2;
    former.position.y = radiusM + 0.003;
    this.group.add(former);

    const coil = new THREE.Mesh(
      helixGeometry(radiusM * 1.06, lengthM, turns, 0.0006, 16),
      Materials.copper(),
    );
    coil.name = 'Coil';
    coil.rotation.z = -Math.PI / 2;
    coil.position.set(-lengthM / 2, radiusM + 0.003, 0);
    // helixGeometry builds along +Y from origin; rotate about Z to lie along X.
    coil.castShadow = true;
    this.group.add(coil);

    const stand = meshOf(roundedBox(lengthM + 0.03, 0.006, 0.05, 0.002), Materials.darkWood(), 'Stand');
    stand.position.y = 0.003;
    this.group.add(stand);

    for (const [name, x] of [
      ['TerminalA', -lengthM / 2 - 0.012],
      ['TerminalB', lengthM / 2 + 0.012],
    ] as const) {
      const terminal = meshOf(new THREE.CylinderGeometry(0.0025, 0.0025, 0.02, 12), Materials.agedBrass(), name);
      terminal.position.set(x, radiusM * 2 + 0.012, 0);
      this.group.add(terminal);
      const anchor = new THREE.Object3D();
      anchor.name = name;
      anchor.position.set(x, radiusM * 2 + 0.022, 0);
      this.group.add(anchor);
    }

    const coreSlot = new THREE.Object3D();
    coreSlot.name = 'CoreSlot';
    coreSlot.position.y = radiusM + 0.003;
    this.group.add(coreSlot);

    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'solenoid', label: 'Solenoid' };
  }

  /** Slide a soft-iron core in (`true`) or out (`false`) of the former. */
  setCore(inserted: boolean): void {
    if (inserted && !this.#core) {
      this.#core = meshOf(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 20), Materials.softIron(), 'IronCore');
      this.#core.rotation.z = Math.PI / 2;
      this.#core.position.set(0, 0.016, 0);
      this.group.add(this.#core);
    }
    if (this.#core) this.#core.visible = inserted;
  }

  get hasCore(): boolean {
    return this.#core?.visible ?? false;
  }

  /** Field strength indicator used by experiments (proportional to NI/L). */
  setCurrent(amperes: number): void {
    this.#current = amperes;
  }

  get current(): number {
    return this.#current;
  }
}

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
