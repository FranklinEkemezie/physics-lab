/**
 * Filament lamps.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/**
 * A lamp bulb for series/parallel and I–V characteristics work.
 * {@link LampModel#setCurrent} lights it up, and the filament resistance rises
 * with temperature exactly as a tungsten filament does.
 */
export class LampModel {
  readonly group = new THREE.Group();
  readonly ratedVoltageV: number;
  readonly ratedPowerW: number;
  #filament: THREE.Mesh;
  #glow: THREE.PointLight;

  constructor(ratedVoltageV = 2.5, ratedPowerW = 0.3) {
    this.ratedVoltageV = ratedVoltageV;
    this.ratedPowerW = ratedPowerW;
    this.group.name = 'Lamp';

    const base = meshOf(new THREE.CylinderGeometry(0.007, 0.008, 0.016, 20), Materials.brass(), 'Base');
    base.position.y = 0.008;
    this.group.add(base);

    const screw = meshOf(new THREE.TorusGeometry(0.0072, 0.0012, 6, 20), Materials.brass(), 'ScrewThread');
    screw.rotation.x = Math.PI / 2;
    screw.position.y = 0.006;
    this.group.add(screw);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.32,
        roughness: 0.02,
        transmission: 0.92,
        thickness: 0.004,
        ior: 1.5,
        side: THREE.DoubleSide,
      }),
    );
    bulb.name = 'Bulb';
    bulb.position.y = 0.021;
    this.group.add(bulb);

    this.#filament = meshOf(
      new THREE.CylinderGeometry(0.0006, 0.0006, 0.012, 6),
      new THREE.MeshBasicMaterial({ color: 0x332a1a }),
      'Filament',
    );
    this.#filament.position.y = 0.022;
    this.group.add(this.#filament);

    this.#glow = new THREE.PointLight(0xffd9a0, 0, 1.2, 2);
    this.#glow.position.y = 0.022;
    this.group.add(this.#glow);

    const positive = new THREE.Object3D();
    positive.name = 'TerminalA';
    positive.position.y = 0;
    const negative = new THREE.Object3D();
    negative.name = 'TerminalB';
    negative.position.set(0, 0.016, 0);
    this.group.add(positive, negative);

    this.setCurrent(0);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'lamp', label: `Lamp ${ratedVoltageV} V ${ratedPowerW} W` };
  }

  /**
   * Light the filament. Resistance is ~10× higher hot than cold, so the
   * current is *not* simply V/R(cold) — that is why I–V graphs curve.
   */
  setCurrent(currentA: number): void {
    const ratedCurrent = this.ratedPowerW / this.ratedVoltageV;
    const fraction = Math.min(1.6, Math.abs(currentA) / ratedCurrent);
    const material = this.#filament.material as THREE.MeshBasicMaterial;
    material.color.setRGB(
      Math.min(1, 0.2 + fraction * 1.6),
      Math.min(1, 0.14 + fraction * 1.2),
      Math.min(1, 0.1 + fraction * 0.35),
    );
    this.#glow.intensity = fraction ** 2.4 * 2.2;
    (this.group.getObjectByName('Bulb') as THREE.Mesh | undefined)?.scale.setScalar(1 + fraction * 0.03);
  }

  /** Cold filament resistance in ohms. */
  get coldResistanceOhms(): number {
    return (this.ratedVoltageV * this.ratedVoltageV) / this.ratedPowerW / 10;
  }
}
