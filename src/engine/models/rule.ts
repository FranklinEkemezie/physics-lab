/**
 * Rules and scales.
 *
 * The metre rule is the primary measuring instrument of the mechanics
 * practical, so it is modelled with real graduations: minor ticks every
 * millimetre, longer ticks every half centimetre, numerals every centimetre.
 * The texture is generated procedurally (see {@link makeVerticalScaleTexture}),
 * so a 30 cm rule and a 1 m rule share one builder.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { makeScaleTexture, makeVerticalScaleTexture, meshOf, roundedBox } from '../geometry';

/** Metadata the UI needs in order to "read" a scale correctly. */
export interface ScaleDescriptor {
  /** `vertical` scales run up the Y axis, `horizontal` along X. */
  orientation: 'vertical' | 'horizontal';
  /** Length of the scale in millimetres. */
  spanMm: number;
  /** Distance from the rule's local origin to the zero graduation, in metres. */
  zeroOffsetM: number;
  /** Local +Z (or +Y) of the scale's face, used for parallax maths. */
  scaleFaceNormal: THREE.Vector3;
  /** Local position of the middle of the scale face. */
  scaleFaceCentre: THREE.Vector3;
  /** Distance from the scale face to the *back* of the rule, in metres. */
  faceThicknessM: number;
  /** Label printed on the rule. */
  label: string;
}

export interface MetreRuleOptions {
  /** Physical length in metres. 1 m for a metre rule, 0.5 m for a half-metre. */
  lengthM?: number;
  /** Rule width in metres. */
  widthM?: number;
  /** Rule thickness in metres. */
  thicknessM?: number;
  /** Where the zero graduation sits: `bottom` (default) or `top`. */
  zeroAt?: 'bottom' | 'top';
  /** Face without graduations (the back), or `both` for a see-through rule. */
  bodyColor?: string;
  /** Paint the graduations on the transparent body (Perspex rule). */
  transparent?: boolean;
  /** Name used on the rule's face. */
  label?: string;
}

/**
 * Build a rule with graduations running up its length.
 *
 * The returned group's local origin sits at the **zero end** of the rule, so
 * `object.position.y` can be used directly as a bench height when the rule is
 * stood upright.
 *
 * <b>Anchors:</b> `ScaleFace` (a plane coplanar with the graduations).
 */
export function buildMetreRule(options: MetreRuleOptions = {}): THREE.Group {
  const {
    lengthM = 1,
    widthM = 0.028,
    thicknessM = 0.005,
    zeroAt = 'bottom',
    // The conventional school rule is a warm manila yellow, not ivory.
    bodyColor = '#f0d26a',
    transparent = false,
    label = 'METRE RULE',
  } = options;

  const group = new THREE.Group();
  group.name = label.replace(/\s+/g, '');

  // ---- Body ------------------------------------------------------------
  const bodyMaterial = transparent
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(bodyColor),
        metalness: 0,
        roughness: 0.08,
        transmission: 0.85,
        thickness: thicknessM,
        transparent: true,
        opacity: 0.6,
        ior: 1.49,
      })
    : new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor), roughness: 0.6, metalness: 0.02 });

  const body = meshOf(
    roundedBox(widthM, lengthM, thicknessM, thicknessM * 0.9),
    bodyMaterial,
    'RuleBody',
  );
  body.position.y = lengthM / 2;
  group.add(body);

  // Bevelled metal end-caps protect the zero end (and hide the box seam).
  const cap = meshOf(new THREE.BoxGeometry(widthM * 1.02, 0.004, thicknessM * 1.05), Materials.chrome(), 'EndCap');
  cap.position.y = 0.002;
  group.add(cap);
  const capTop = cap.clone();
  capTop.position.y = lengthM - 0.002;
  group.add(capTop);

  // ---- Graduations ------------------------------------------------------
  const spanMm = lengthM * 1000;
  const texture = makeVerticalScaleTexture({
    spanMm,
    pixelsPerMm: Math.min(1.6, 1400 / spanMm),
    heightPx: Math.max(96, Math.round(widthM * 4200)),
    majorEveryMm: 10,
    minorPerMajor: 10,
    numbers: true,
    numberOffsetMm: 0,
    background: transparent ? '#f4f0e0' : bodyColor,
    ink: '#141414',
  });

  const scaleFace = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM * 0.985, lengthM * 0.995),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0,
      transparent: transparent,
      opacity: transparent ? 0.96 : 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  scaleFace.name = 'ScaleFace';
  // PlaneGeometry v runs bottom→top which already matches our bitmap.
  scaleFace.position.set(0, lengthM / 2, thicknessM / 2 + 0.0002);
  group.add(scaleFace);

  // The reading edge — a hairline along the graduations' inner ends.
  const edge = meshOf(
    new THREE.BoxGeometry(0.0006, lengthM, thicknessM * 1.001),
    Materials.blackSteel(),
    'ReadingEdge',
  );
  edge.position.set(-widthM / 2 + 0.0012, lengthM / 2, 0);
  edge.castShadow = false;
  group.add(edge);

  // ---- Metadata ---------------------------------------------------------
  const descriptor: ScaleDescriptor = {
    orientation: 'vertical',
    spanMm,
    zeroOffsetM: zeroAt === 'bottom' ? 0 : lengthM,
    scaleFaceNormal: new THREE.Vector3(0, 0, 1),
    scaleFaceCentre: new THREE.Vector3(0, lengthM / 2, thicknessM / 2),
    faceThicknessM: thicknessM,
    label,
  };
  group.userData.scale = descriptor;
  group.userData.isHandle = true;
  group.userData.apparatus = { id: 'metre-rule', label };
  return group;
}

/**
 * The heavy wooden block with a saw-cut slot that holds a metre rule upright.
 * Without it the rule would topple — a fact every student discovers.
 */
export function buildRuleFoot(options: { widthM?: number; depthM?: number; heightM?: number } = {}): THREE.Group {
  const { widthM = 0.13, depthM = 0.09, heightM = 0.03 } = options;
  const group = new THREE.Group();
  group.name = 'RuleFoot';

  const block = meshOf(roundedBox(widthM, heightM, depthM, 0.005), Materials.darkWood(), 'Block');

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, heightM * 1.05, depthM * 1.02),
    new THREE.MeshStandardMaterial({ color: 0x120c07, roughness: 1 }),
  );
  slot.position.set(0, 0, 0);
  group.add(block, slot);
  return group;
}

/**
 * A short (30 cm) rule with graduations, lying flat on the bench, graduating
 * left → right. Used for optical bench distances and ray diagrams.
 */
export function buildFlatRule(options: { lengthM?: number; widthM?: number } = {}): THREE.Group {
  const { lengthM = 0.3, widthM = 0.03 } = options;
  const group = new THREE.Group();
  group.name = 'FlatRule';

  const thicknessM = 0.004;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf0d26a, roughness: 0.6 });
  const body = meshOf(roundedBox(lengthM, widthM, thicknessM, thicknessM), bodyMaterial, 'RuleBody');
  // roundedBox extrudes along +Z, so rotate it flat on the bench.
  body.rotation.x = -Math.PI / 2;
  body.position.set(lengthM / 2, thicknessM / 2, 0);
  group.add(body);

  const texture = makeScaleTexture({
    spanMm: lengthM * 1000,
    pixelsPerMm: Math.min(4, 1600 / (lengthM * 1000)),
    heightPx: Math.max(64, Math.round(widthM * 3600)),
    majorEveryMm: 10,
    minorPerMajor: 10,
    numbers: true,
    background: '#f0d26a',
  });

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(lengthM * 0.99, widthM * 0.96),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  face.name = 'ScaleFace';
  face.rotation.x = -Math.PI / 2;
  face.position.set(lengthM / 2, thicknessM + 0.0002, 0);
  group.add(face);

  const descriptor: ScaleDescriptor = {
    orientation: 'horizontal',
    spanMm: lengthM * 1000,
    zeroOffsetM: 0,
    scaleFaceNormal: new THREE.Vector3(0, 1, 0),
    scaleFaceCentre: new THREE.Vector3(lengthM / 2, thicknessM, 0),
    faceThicknessM: thicknessM,
    label: 'RULE',
  };
  group.userData.scale = descriptor;
  return group;
}
