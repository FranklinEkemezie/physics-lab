/**
 * Flexible patch leads.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, stretchThread, threadBetween } from '../../geometry';

/**
 * A flexible patch lead that can be connected between two points in the
 * scene. The cable sags under its own weight (a catenary), because straight
 * wires look wrong and students use the sag to see which lead is which.
 */
export class PatchLead {
  readonly group = new THREE.Group();
  readonly colour: string;
  #lengthM: number;

  constructor(colour: string, lengthM = 0.3) {
    this.colour = colour;
    this.#lengthM = lengthM;
    this.group.name = 'PatchLead';

    const mesh = threadBetween(0.0022, 10);
    mesh.name = 'Cable';
    mesh.material = Materials.wire(colour);
    mesh.castShadow = true;
    this.group.add(mesh);

    const clipGeometry = new THREE.ConeGeometry(0.0045, 0.016, 12);
    for (const name of ['ClipA', 'ClipB'] as const) {
      const clip = meshOf(clipGeometry, Materials.chrome(), name);
      this.group.add(clip);
    }
    this.group.userData.apparatus = { id: 'patch-lead', label: `${colour} lead` };
  }

  /**
   * Route the cable between two world points, hanging with a sag proportional
   * to the slack (any cable shorter than the distance is pulled taut).
   */
  connect(from: THREE.Vector3, to: THREE.Vector3, slack = 0.35): void {
    const direct = from.distanceTo(to);
    const length = Math.max(direct * (1 + slack), this.#lengthM * 0.4);
    const sag = Math.max(0, length - direct) * 0.55 + 0.004;

    const mids: THREE.Vector3[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(from, to, t);
      // Parabolic sag, deepest in the middle.
      point.y -= sag * Math.sin(Math.PI * t);
      mids.push(point);
    }

    const cable = this.group.getObjectByName('Cable') as THREE.Mesh;
    cable.geometry.dispose();
    cable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mids), segments, 0.0022, 8, false);

    const clipA = this.group.getObjectByName('ClipA') as THREE.Mesh;
    const clipB = this.group.getObjectByName('ClipB') as THREE.Mesh;
    const dirA = new THREE.Vector3().subVectors(mids[1] ?? to, from).normalize();
    const dirB = new THREE.Vector3().subVectors(to, mids[segments - 1] ?? from).normalize();
    clipA.position.copy(from);
    clipA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirA);
    clipB.position.copy(to);
    clipB.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirB);
  }

  /** Straight-line shortcut used when a lead is not connected to anything. */
  span(from: THREE.Vector3, to: THREE.Vector3): void {
    const cable = this.group.getObjectByName('Cable') as THREE.Mesh;
    stretchThread(cable, from, to);
  }
}
