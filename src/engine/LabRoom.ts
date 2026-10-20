/**
 * The physical room the lab lives in: floor, walls, ceiling light fittings and
 * — most importantly — the bench everything stands on.
 *
 * Dimensions are realistic SI metres, which matters because the metre rule
 * has to agree with the world it is measuring.
 */

import * as THREE from 'three';
import { Materials, labFloorMaterial } from './materials';
import { meshOf, roundedBox } from './geometry';

/** Height of the bench top surface above the floor, in metres. */
export const BENCH_HEIGHT = 0.92;
/** Half-width (x) of the bench top. */
export const BENCH_HALF_WIDTH = 1.35;
/** Half-depth (z) of the bench top. */
export const BENCH_HALF_DEPTH = 0.62;

export interface RoomOptions {
  /** Side length of the square room in metres. */
  size?: number;
  /** Enable shadows from the key light (costly on weak GPUs). */
  shadows?: boolean;
}

export class LabRoom {
  readonly root = new THREE.Group();
  /** The whole bench assembly; the top surface is at {@link BENCH_HEIGHT}. */
  readonly bench: THREE.Group;
  readonly keyLight: THREE.DirectionalLight;
  readonly fillLight: THREE.HemisphereLight;
  readonly ceilingGroup = new THREE.Group();
  #ceilingOn = true;

  constructor(options: RoomOptions = {}) {
    const { size = 14, shadows = true } = options;
    this.root.name = 'LabRoom';

    // ---- Floor -----------------------------------------------------------
    const floor = meshOf(new THREE.PlaneGeometry(size, size), labFloorMaterial(), 'Floor');
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    this.root.add(floor);

    // ---- Walls (two, so the camera never sees "nothing") ------------------
    const wallMaterial = Materials.paint('#2a2f36', 0.9);
    const backWall = meshOf(new THREE.PlaneGeometry(size, 5), wallMaterial, 'BackWall');
    backWall.position.set(0, 2.5, -size / 2);
    backWall.castShadow = false;
    backWall.receiveShadow = true;
    this.root.add(backWall);

    const sideWall = meshOf(new THREE.PlaneGeometry(size, 5), wallMaterial, 'SideWall');
    sideWall.position.set(-size / 2, 2.5, 0);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.castShadow = false;
    this.root.add(sideWall);

    // Faint skirting boards sell the "room" without extra cost.
    const skirting = meshOf(new THREE.BoxGeometry(size, 0.12, 0.03), Materials.paint('#1a1e23', 0.8));
    skirting.position.set(0, 0.06, -size / 2 + 0.02);
    this.root.add(skirting);

    // ---- Bench -----------------------------------------------------------
    this.bench = this.#buildBench();
    this.root.add(this.bench);

    // ---- Lighting --------------------------------------------------------
    this.fillLight = new THREE.HemisphereLight(0xdfe9ff, 0x2c2620, 0.55);
    this.root.add(this.fillLight);

    this.keyLight = new THREE.DirectionalLight(0xfff2dd, 2.1);
    this.keyLight.position.set(2.6, 4.4, 2.0);
    this.keyLight.target.position.set(0, BENCH_HEIGHT, 0);
    this.keyLight.castShadow = shadows;
    if (shadows) {
      this.keyLight.shadow.mapSize.set(2048, 2048);
      this.keyLight.shadow.camera.near = 0.5;
      this.keyLight.shadow.camera.far = 14;
      const extent = 3.2;
      this.keyLight.shadow.camera.left = -extent;
      this.keyLight.shadow.camera.right = extent;
      this.keyLight.shadow.camera.top = extent;
      this.keyLight.shadow.camera.bottom = -extent;
      this.keyLight.shadow.bias = -0.0006;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.root.add(this.keyLight);
    this.root.add(this.keyLight.target);

    // A cool rim light from behind separates the apparatus from the wall.
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.55);
    rim.position.set(-3.0, 2.6, -2.4);
    this.root.add(rim);

    this.ceilingGroup.position.set(0, 3.6, 0);
    this.#buildCeiling();
    this.root.add(this.ceilingGroup);
  }

  #buildBench(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Bench';

    const topThickness = 0.055;
    // `roundedBox` is already a box of exactly (width, height, depth) with its
    // faces square to the axes, so the top goes straight on — no rotation.
    const top = meshOf(
      roundedBox(BENCH_HALF_WIDTH * 2, topThickness, BENCH_HALF_DEPTH * 2, 0.012),
      Materials.wood(),
      'BenchTop',
    );
    top.position.y = BENCH_HEIGHT - topThickness / 2;

    // Dark hardboard inlay in the middle of the bench (common in school labs).
    const inlay = meshOf(
      new THREE.BoxGeometry(1.1, 0.004, 0.5),
      Materials.paint('#2f3a34', 0.95),
      'BenchInlay',
    );
    inlay.position.set(0, BENCH_HEIGHT + 0.001, 0);
    inlay.castShadow = false;

    const legHeight = BENCH_HEIGHT - topThickness;
    const legGeometry = new THREE.BoxGeometry(0.075, legHeight, 0.075);
    const legMaterial = Materials.paint('#3a3f45', 0.7);
    const legPositions: [number, number][] = [
      [BENCH_HALF_WIDTH - 0.1, BENCH_HALF_DEPTH - 0.1],
      [-(BENCH_HALF_WIDTH - 0.1), BENCH_HALF_DEPTH - 0.1],
      [BENCH_HALF_WIDTH - 0.1, -(BENCH_HALF_DEPTH - 0.1)],
      [-(BENCH_HALF_WIDTH - 0.1), -(BENCH_HALF_DEPTH - 0.1)],
    ];
    for (const [x, z] of legPositions) {
      const leg = meshOf(legGeometry, legMaterial, 'BenchLeg');
      leg.position.set(x, legHeight / 2, z);
      group.add(leg);
    }

    // Stretcher rail between the legs (stops the bench looking spindly).
    const rail = meshOf(new THREE.BoxGeometry(BENCH_HALF_WIDTH * 2 - 0.3, 0.06, 0.04), legMaterial);
    rail.position.set(0, 0.22, BENCH_HALF_DEPTH - 0.1);
    group.add(rail);
    const railBack = rail.clone();
    railBack.position.z = -(BENCH_HALF_DEPTH - 0.1);
    group.add(railBack);

    // A shallow drawer front adds a lot of "chemistry lab" character.
    const drawer = meshOf(new THREE.BoxGeometry(0.62, 0.16, 0.02), Materials.darkWood(), 'Drawer');
    drawer.position.set(-0.35, BENCH_HEIGHT - 0.14, BENCH_HALF_DEPTH - 0.005);
    group.add(drawer);
    const handle = meshOf(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10), Materials.chrome(), 'DrawerHandle');
    handle.rotation.z = Math.PI / 2;
    handle.position.set(-0.35, BENCH_HEIGHT - 0.14, BENCH_HALF_DEPTH + 0.015);
    group.add(handle);

    group.add(top, inlay);
    return group;
  }

  #buildCeiling(): void {
    const housing = meshOf(
      new THREE.BoxGeometry(1.6, 0.09, 0.42),
      Materials.paint('#20242a', 0.6),
      'LightFitting',
    );
    const diffuser = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff4e0,
        emissiveIntensity: 1.4,
        roughness: 1,
      }),
    );
    diffuser.rotation.x = Math.PI / 2;
    diffuser.position.y = -0.05;
    diffuser.name = 'LightDiffuser';

    const spot = new THREE.SpotLight(0xfff6e8, 12, 8, Math.PI / 3.1, 0.55, 1.5);
    spot.position.set(0, -0.1, 0);
    spot.target.position.set(0, -BENCH_HEIGHT - 1.2, 0);
    spot.castShadow = false;

    this.ceilingGroup.add(housing, diffuser, spot, spot.target);
  }

  /** Toggle the ceiling lamp (nice for showing "dark room" optics work). */
  setCeilingLight(on: boolean): void {
    this.#ceilingOn = on;
    this.ceilingGroup.visible = on;
    this.keyLight.intensity = on ? 2.1 : 0.35;
    this.fillLight.intensity = on ? 0.55 : 0.12;
  }

  get ceilingOn(): boolean {
    return this.#ceilingOn;
  }

  /** World position of a point on the bench surface. */
  static benchPoint(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, BENCH_HEIGHT, z);
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}
