/**
 * Projection screens.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeScaleTexture, meshOf, roundedBox } from '../../geometry';

/**
 * White screen with a millimetre grid, for image work and diffraction.
 * Sits on a stand so its height can be adjusted.
 */
export function buildScreen(options: { widthM?: number; heightM?: number } = {}): THREE.Group {
  const { widthM = 0.12, heightM = 0.1 } = options;
  const group = new THREE.Group();
  group.name = 'Screen';

  const board = meshOf(roundedBox(widthM, heightM, 0.005, 0.004), Materials.screen(), 'Board');
  board.position.y = heightM / 2 + 0.03;
  group.add(board);

  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM * 0.94, heightM * 0.94),
    new THREE.MeshBasicMaterial({
      map: makeScaleTexture({
        spanMm: 100,
        pixelsPerMm: 8,
        heightPx: 64,
        majorEveryMm: 10,
        minorPerMajor: 2,
        background: '#fbfbf6',
        ink: 'rgba(60,60,60,0.5)',
        numbers: false,
        repeat: 1,
      }),
      transparent: true,
      opacity: 0.5,
    }),
  );
  grid.name = 'ScaleGrid';
  grid.position.set(0, heightM / 2 + 0.03, 0.0028);
  group.add(grid);

  const stalk = meshOf(new THREE.BoxGeometry(0.008, 0.03, 0.008), Materials.aluminium(), 'Stalk');
  stalk.position.y = 0.015;
  const foot = meshOf(new THREE.BoxGeometry(0.07, 0.006, 0.04), Materials.aluminium(), 'Foot');
  foot.position.y = 0.003;
  group.add(stalk, foot);

  const centre = new THREE.Object3D();
  centre.name = 'ScreenCentre';
  centre.position.set(0, heightM / 2 + 0.03, 0.0028);
  group.add(centre);

  group.userData.isHandle = true;
  group.userData.apparatus = { id: 'screen', label: 'White screen' };
  return group;
}
