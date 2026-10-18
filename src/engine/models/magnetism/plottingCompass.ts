/**
 * Plotting compasses.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf } from '../../geometry';

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
