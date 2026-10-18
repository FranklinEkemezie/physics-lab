/**
 * Protractors.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf } from '../../geometry';

/** A protractor for measuring angles of incidence and refraction. */
export function buildProtractor(radiusM = 0.05): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Protractor';

  const shape = new THREE.Shape();
  shape.absarc(0, 0, radiusM, 0, Math.PI, false);
  shape.lineTo(-radiusM, 0);
  shape.absarc(0, 0, radiusM * 0.94, Math.PI, 0, true);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: false });
  const body = new THREE.Mesh(geometry, Materials.acrylic().clone());
  body.rotation.x = -Math.PI / 2;
  body.name = 'ProtractorBody';
  group.add(body);

  for (let degrees = 0; degrees <= 180; degrees += 10) {
    const angle = THREE.MathUtils.degToRad(degrees);
    const isMajor = degrees % 10 === 0;
    const tick = meshOf(
      new THREE.BoxGeometry(0.0004, 0.0015, isMajor ? radiusM * 0.12 : radiusM * 0.07),
      Materials.blackSteel(),
      'Tick',
    );
    tick.position.set(Math.cos(angle) * radiusM * 0.92, 0.001, Math.sin(angle) * radiusM * 0.92);
    tick.rotation.y = -angle;
    tick.castShadow = false;
    group.add(tick);
  }

  const label = makeLabelPlane({
    text: '0 – 180°',
    widthM: radiusM * 0.9,
    fontScale: 0.16,
    foreground: '#333',
  });
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.0028, radiusM * 0.35);
  group.add(label);

  group.userData.apparatus = { id: 'protractor', label: 'Protractor' };
  group.userData.isHandle = true;
  return group;
}
