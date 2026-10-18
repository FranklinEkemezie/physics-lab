/**
 * Optical benches.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeScaleTexture, meshOf } from '../../geometry';

/**
 * Optical bench: a graduated rail with sliding carriers. The scale is real
 * (centimetre graduations) so students can read object and image distances.
 */
export class OpticalBenchModel {
  readonly group = new THREE.Group();
  readonly lengthM: number;

  constructor(lengthM = 1) {
    this.lengthM = lengthM;
    this.group.name = 'OpticalBench';

    const railHeight = 0.014;
    const rail = meshOf(new THREE.BoxGeometry(lengthM, 0.012, 0.055), Materials.aluminium(), 'Rail');
    rail.position.y = railHeight;
    this.group.add(rail);

    // Graduated strip on the front face of the rail.
    const scale = new THREE.Mesh(
      new THREE.PlaneGeometry(lengthM * 0.99, 0.038),
      new THREE.MeshStandardMaterial({
        map: makeScaleTexture({
          spanMm: lengthM * 1000,
          pixelsPerMm: Math.min(3, 2000 / (lengthM * 1000)),
          heightPx: 96,
          majorEveryMm: 10,
          minorPerMajor: 10,
          numbers: true,
          background: '#e9e5da',
        }),
        roughness: 0.8,
      }),
    );
    scale.name = 'RailScale';
    scale.position.set(0, railHeight, 0.0276);
    this.group.add(scale);

    // End stops.
    for (const x of [-lengthM / 2, lengthM / 2]) {
      const stop = meshOf(new THREE.BoxGeometry(0.012, 0.026, 0.06), Materials.aluminium(), 'EndStop');
      stop.position.set(x, railHeight + 0.006, 0);
      this.group.add(stop);
    }

    for (const x of [-lengthM / 2 + 0.1, 0, lengthM / 2 - 0.1]) {
      const foot = meshOf(new THREE.BoxGeometry(0.05, 0.008, 0.075), Materials.castIron(), 'Foot');
      foot.position.set(x, 0.004, 0);
      this.group.add(foot);
    }

    this.group.userData.apparatus = { id: 'optical-bench', label: `Optical bench (${lengthM * 100} cm)` };
    this.group.userData.scale = {
      orientation: 'horizontal',
      spanMm: lengthM * 1000,
      zeroOffsetM: -lengthM / 2,
      scaleFaceNormal: new THREE.Vector3(0, 0, 1),
      scaleFaceCentre: new THREE.Vector3(0, railHeight, 0.028),
      faceThicknessM: 0.055,
      label: 'OPTICAL BENCH',
    };
  }

  /** A slider carrying any object along the rail. */
  makeCarrier(object: THREE.Object3D): THREE.Group {
    const carrier = new THREE.Group();
    carrier.name = 'Carrier';
    const saddle = meshOf(new THREE.BoxGeometry(0.03, 0.012, 0.062), Materials.aluminium(), 'Saddle');
    saddle.position.y = 0.028;
    const post = meshOf(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), Materials.chrome(), 'Post');
    post.position.y = 0.046;
    carrier.add(saddle, post);
    object.position.y = 0.06;
    carrier.add(object);
    return carrier;
  }
}
