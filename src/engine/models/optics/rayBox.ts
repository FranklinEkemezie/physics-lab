/**
 * Ray box: a metal box with a collimating slit that throws parallel rays.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';

/**
 * Ray box: a metal box with a collimating slit that throws one, three or five
 * parallel rays. Used for reflection, refraction and critical-angle work.
 *
 * <b>Anchors:</b> `Aperture` — where the rays leave the box.
 */
export class RayBoxModel {
  readonly group = new THREE.Group();
  #rays: THREE.Mesh[] = [];
  #lamp: THREE.PointLight;
  #on = true;
  #rayCount = 3;

  constructor() {
    this.group.name = 'RayBox';

    const body = meshOf(roundedBox(0.13, 0.075, 0.075, 0.006), Materials.paint('#2f3338', 0.45), 'Body');
    body.rotation.x = -Math.PI / 2;
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.038, 0);
    this.group.add(body);

    const well = meshOf(roundedBox(0.11, 0.062, 0.05, 0.004), Materials.paint('#22262a', 0.6), 'Well');
    well.position.set(0, 0.03, 0.032);
    this.group.add(well);

    // Aperture plate with slits at the business end.
    const aperture = meshOf(new THREE.BoxGeometry(0.004, 0.07, 0.07), Materials.paint('#e8e3d6', 0.5), 'AperturePlate');
    aperture.position.set(0.066, 0.038, 0);
    this.group.add(aperture);

    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.0016),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0 }),
    );
    slit.rotation.y = Math.PI / 2;
    slit.position.set(0.0685, 0.038, 0);
    slit.name = 'Slit';
    this.group.add(slit);

    // Carry handle.
    const handle = meshOf(new THREE.TorusGeometry(0.026, 0.0035, 8, 24, Math.PI), Materials.chrome(), 'Handle');
    handle.position.set(-0.02, 0.075, 0);
    handle.rotation.y = Math.PI / 2;
    this.group.add(handle);

    // Collimated beams, built as thin translucent boxes.
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff2c4,
      transparent: true,
      opacity: 0.33,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamLength = 0.9;
    for (let i = 0; i < 5; i += 1) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(beamLength, 0.0022, 0.0022), beamMaterial);
      beam.position.set(0.0685 + beamLength / 2, 0.038 + (i - 2) * 0.014, 0);
      beam.name = `Beam${i}`;
      this.#rays.push(beam);
      this.group.add(beam);
    }
    this.setRayCount(this.#rayCount);

    this.#lamp = new THREE.PointLight(0xffe9b0, 0.7, 1.6, 2);
    this.#lamp.position.set(0.02, 0.038, 0);
    this.group.add(this.#lamp);

    const apertureAnchor = new THREE.Object3D();
    apertureAnchor.name = 'Aperture';
    apertureAnchor.position.set(0.0685, 0.038, 0);
    this.group.add(apertureAnchor);

    this.group.userData.apparatus = { id: 'ray-box', label: 'Ray box' };
    this.group.userData.isHandle = true;
  }

  /** Show 1, 3 or 5 beams. */
  setRayCount(count: number): void {
    this.#rayCount = count;
    const shown: number[] =
      count <= 1 ? [2] : count === 3 ? [1, 2, 3] : [0, 1, 2, 3, 4];
    this.#rays.forEach((beam, index) => {
      beam.visible = this.#on && shown.includes(index);
    });
  }

  setOn(on: boolean): void {
    this.#on = on;
    this.#lamp.intensity = on ? 0.7 : 0;
    this.setRayCount(this.#rayCount);
  }

  get isOn(): boolean {
    return this.#on;
  }

  /** The beams, for experiments that need to raycast against them. */
  get beams(): readonly THREE.Mesh[] {
    return this.#rays;
  }
}
