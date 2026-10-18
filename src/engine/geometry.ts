/**
 * Geometry helpers used by every procedural model.
 *
 * The lab's apparatus is *built from code* rather than loaded from binary
 * assets. That keeps the repository text-only, makes every dimension
 * inspectable and tweakable, and lets models be parameterised (a 50 cm rule
 * and a 1 m rule are the same builder with a different argument).
 */

import * as THREE from 'three';

/** Merge a list of geometries into one buffer geometry (fewer draw calls). */
export function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  if (geometries.length === 0) return merged;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const index = geometry.getIndex();

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (index) {
      for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + offset);
    } else {
      for (let i = 0; i < position.count; i += 1) indices.push(i + offset);
    }

    offset += position.count;
    geometry.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

/** A cylinder aligned along the Y axis, positioned/rotated by helper options. */
export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 24,
): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false);
}

/**
 * Build a mesh from a geometry + material, with sensible shadow defaults.
 * Every apparatus mesh casts and receives shadows in this lab.
 */
export function meshOf(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/** Slightly rounded box (chamfered look) built from a scaled box + segments. */
export function roundedBox(width: number, height: number, depth: number, radius = 0.02): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = width / 2 - radius;
  const h = height / 2 - radius;

  shape.moveTo(-w - radius, -h);
  shape.lineTo(-w - radius, h);
  shape.quadraticCurveTo(-w, h, -w, h + radius);
  shape.lineTo(w, h + radius);
  shape.quadraticCurveTo(w, h, w + radius, h);
  shape.lineTo(w + radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h - radius);
  shape.lineTo(-w, -h - radius);
  shape.quadraticCurveTo(-w, -h, -w - radius, -h);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: radius * 0.5,
    bevelThickness: radius * 0.5,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export interface ScaleTextureOptions {
  /** Physical width the texture spans, in millimetres. */
  spanMm: number;
  /** Pixels per millimetre of the generated bitmap. */
  pixelsPerMm?: number;
  /** Height of the generated bitmap in pixels. */
  heightPx?: number;
  /** Distance between numbered major graduations, in mm (e.g. 10 = centimetre). */
  majorEveryMm?: number;
  /** Number of minor divisions inside each major division. */
  minorPerMajor?: number;
  /** Colour of the paper/body behind the graduations. */
  background?: string;
  /** Colour of the ticks and numerals. */
  ink?: string;
  /** Draw numbers on the majors. */
  numbers?: boolean;
  /** Where the numbering starts, in mm. */
  numberOffsetMm?: number;
  /** Repeat the texture horizontally (for a rule that is longer than the span). */
  repeat?: number;
}

/**
 * Paint a linear measuring scale onto a canvas and return it as a texture.
 *
 * Used by the metre rule, the optical bench rail, the spring scale... any
 * object that a student has to *read* rather than merely look at.
 */
export function makeScaleTexture(options: ScaleTextureOptions): THREE.CanvasTexture {
  const {
    spanMm,
    pixelsPerMm = 4,
    heightPx = 96,
    majorEveryMm = 10,
    minorPerMajor = 10,
    background = '#f6f0dc',
    ink = '#1b1b1b',
    numbers = true,
    numberOffsetMm = 0,
    repeat = 1,
  } = options;

  const widthPx = Math.max(64, Math.round(spanMm * pixelsPerMm));
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, widthPx, heightPx);

  const pxPerMm = widthPx / spanMm;
  const minorMm = majorEveryMm / minorPerMajor;

  ctx.strokeStyle = ink;
  for (let mm = 0; mm <= spanMm + 1e-6; mm += minorMm) {
    const isMajor = Math.abs(mm % majorEveryMm) < 1e-6;
    const isMid = !isMajor && minorPerMajor > 2 && Math.abs((mm % majorEveryMm) - majorEveryMm / 2) < 1e-6;
    const x = mm * pxPerMm;
    const tickLength = isMajor ? heightPx * 0.62 : isMid ? heightPx * 0.42 : heightPx * 0.28;
    ctx.lineWidth = isMajor ? Math.max(1.4, pxPerMm * 0.35) : Math.max(1, pxPerMm * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, heightPx);
    ctx.lineTo(x, heightPx - tickLength);
    ctx.stroke();
  }

  if (numbers) {
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(heightPx * 0.34)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let mm = 0; mm <= spanMm + 1e-6; mm += majorEveryMm) {
      const x = mm * pxPerMm;
      ctx.fillText(String(Math.round(numberOffsetMm + mm / 10)), x, heightPx * 0.04);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat !== 1) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(repeat, 1);
  }
  return texture;
}

/**
 * Paint a *vertical* measuring scale (a height gauge / stadia rule).
 *
 * The metre rule is mounted upright next to the pendulum, so its graduations
 * run up the bitmap: 0 cm at the bottom, 100 cm at the top, with the numerals
 * kept upright for easy reading — just like a wall-mounted height scale.
 */
export function makeVerticalScaleTexture(options: ScaleTextureOptions): THREE.CanvasTexture {
  const {
    spanMm,
    pixelsPerMm = 1,
    heightPx = 128, // = bitmap WIDTH here; the scale runs along the bitmap height
    majorEveryMm = 10,
    minorPerMajor = 10,
    background = '#f3ead2',
    ink = '#1b1b1b',
    numbers = true,
    numberOffsetMm = 0,
  } = options;

  const lengthPx = Math.max(64, Math.round(spanMm * pixelsPerMm));
  const canvas = document.createElement('canvas');
  canvas.width = heightPx; // the short side of the rule
  canvas.height = lengthPx; // the long side of the rule
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pxPerMm = lengthPx / spanMm;
  const minorMm = majorEveryMm / minorPerMajor;

  ctx.strokeStyle = ink;
  for (let mm = 0; mm <= spanMm + 1e-6; mm += minorMm) {
    const isMajor = Math.abs(mm % majorEveryMm) < 1e-6;
    const isMid =
      !isMajor && minorPerMajor > 2 && Math.abs((mm % majorEveryMm) - majorEveryMm / 2) < 1e-6;
    // Canvas y grows downwards, so 0 mm sits at the bottom of the bitmap.
    const y = canvas.height - mm * pxPerMm;
    const tickLength = isMajor ? canvas.width * 0.62 : isMid ? canvas.width * 0.4 : canvas.width * 0.26;
    ctx.lineWidth = isMajor ? Math.max(1.4, pxPerMm * 0.35) : Math.max(1, pxPerMm * 0.2);
    ctx.beginPath();
    ctx.moveTo(canvas.width, y);
    ctx.lineTo(canvas.width - tickLength, y);
    ctx.stroke();
  }

  if (numbers) {
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.round(canvas.width * 0.3)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let mm = 0; mm <= spanMm + 1e-6; mm += majorEveryMm) {
      const y = canvas.height - mm * pxPerMm;
      const label = String(Math.round(numberOffsetMm + mm / 10));
      ctx.fillText(label, canvas.width * 0.36, y);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

export interface DialTextureOptions {  /** Text printed in the middle of the dial, e.g. "AMMETER". */
  label: string;
  /** Full-scale deflection value printed at the right-hand end. */
  fullScale: number;
  /** Physical/printed unit shown on the dial. */
  unit?: string;
  /** Redline value; anything past it is "off scale". */
  redline?: number;
  sizePx?: number;
  background?: string;
  ink?: string;
}

/**
 * Draw an analogue meter face (moving-coil ammeter/voltmeter/galvanometer).
 * The needle itself is a separate 3D mesh so it can actually move.
 */
export function makeDialTexture(options: DialTextureOptions): THREE.CanvasTexture {
  const {
    label,
    fullScale,
    unit = '',
    redline,
    sizePx = 512,
    background = '#f7f3e6',
    ink = '#151515',
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const radius = sizePx * 0.44;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, sizePx, sizePx);

  ctx.strokeStyle = ink;
  ctx.lineWidth = sizePx * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // The scale sweeps 120° either side of "straight up".
  const startAngle = -Math.PI / 2 - Math.PI / 3;
  const endAngle = -Math.PI / 2 + Math.PI / 3;
  const divisions = 10;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(sizePx * 0.045)}px "Segoe UI", system-ui, sans-serif`;

  for (let i = 0; i <= divisions; i += 1) {
    const t = i / divisions;
    const angle = startAngle + (endAngle - startAngle) * t;
    const outer = radius * 0.94;
    const inner = i % 1 === 0 ? radius * 0.78 : radius * 0.86;
    const isMajor = i % 1 === 0;
    ctx.lineWidth = isMajor ? sizePx * 0.008 : sizePx * 0.004;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();

    if (isMajor) {
      const labelRadius = radius * 0.66;
      ctx.fillText(
        String(Math.round((fullScale * i) / divisions)),
        cx + Math.cos(angle) * labelRadius,
        cy + Math.sin(angle) * labelRadius,
      );
    }
  }

  // Minor graduations (every fifth of a major division).
  ctx.lineWidth = sizePx * 0.003;
  for (let i = 0; i < divisions; i += 1) {
    for (let j = 1; j < 5; j += 1) {
      const t = (i + j / 5) / divisions;
      const angle = startAngle + (endAngle - startAngle) * t;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius * 0.88, cy + Math.sin(angle) * radius * 0.88);
      ctx.lineTo(cx + Math.cos(angle) * radius * 0.94, cy + Math.sin(angle) * radius * 0.94);
      ctx.stroke();
    }
  }

  if (redline !== undefined) {
    const t = Math.min(1, redline / fullScale);
    const angle = startAngle + (endAngle - startAngle) * t;
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = sizePx * 0.014;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.97, angle - 0.04, angle + 0.04);
    ctx.stroke();
    ctx.strokeStyle = ink;
  }

  ctx.fillStyle = ink;
  ctx.font = `bold ${Math.round(sizePx * 0.062)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(label, cx, cy + radius * 0.32);

  if (unit) {
    ctx.font = `${Math.round(sizePx * 0.05)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(unit, cx, cy + radius * 0.55);
  }

  // Small symbol strip along the bottom of the dial.
  ctx.font = `${Math.round(sizePx * 0.038)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('\u2014 DC \u2014', cx, cy + radius * 0.78);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export interface LabelTextureOptions {
  /** Text to print, e.g. "50 g" or "0 – 5 A". */
  text: string;
  /** Canvas size in pixels (square). */
  sizePx?: number;
  foreground?: string;
  /** `null` for a transparent background. */
  background?: string | null;
  /** Font size as a fraction of the canvas. */
  fontScale?: number;
  bold?: boolean;
  /** Multi-line labels: split on '\n'. */
  lineHeight?: number;
}

/**
 * Rasterise a short label onto a texture. Used for engraved markings
 * (mass values, meter ranges, resistance-box decades...).
 */
export function makeLabelTexture(options: LabelTextureOptions): THREE.CanvasTexture {
  const {
    text,
    sizePx = 256,
    foreground = '#1a1a1a',
    background = null,
    fontScale = 0.3,
    bold = true,
    lineHeight = 1.15,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }

  const lines = text.split('\n');
  const fontSize = sizePx * fontScale;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const step = fontSize * lineHeight;
  const start = sizePx / 2 - ((lines.length - 1) * step) / 2;
  lines.forEach((line, i) => ctx.fillText(line, sizePx / 2, start + i * step));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * A flat, transparent plane carrying a text label. Useful as a decal on the
 * top face of an object (rotated flat) or on a dial.
 */
export function makeLabelPlane(
  options: LabelTextureOptions & { widthM: number; heightM?: number },
): THREE.Mesh {
  const { widthM, heightM = widthM } = options;
  const texture = makeLabelTexture(options);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, heightM),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Generate a soft radial gradient sprite, handy for glows and bulbs. */export function makeGlowSprite(color: THREE.ColorRepresentation, size = 128): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx?.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (ctx && gradient) {
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,244,214,0.85)');
    gradient.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  return sprite;
}

/**
 * A thin, taut line of thread between two points.
 * Uses a cylinder so it casts a shadow and reads correctly in 3D.
 */
export function threadBetween(radius = 0.0028, segments = 8): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, 1, segments, 1, true);
  geometry.translate(0, 0.5, 0); // pivot at the bottom so we can scale/orient
  const mesh = new THREE.Mesh(geometry);
  return mesh;
}

/**
 * Orient + stretch a unit-length "thread" mesh so it spans a → b.
 * The unit thread is 1 m tall and pivots at its base.
 */
export function stretchThread(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  mesh.position.copy(from);
  mesh.scale.set(1, Math.max(length, 1e-5), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

/** Build a helix (spring or coil) as a TubeGeometry along a helical curve. */
export function helixGeometry(
  radius: number,
  height: number,
  turns: number,
  wireRadius: number,
  segmentsPerTurn = 24,
): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  const total = Math.max(8, Math.floor(turns * segmentsPerTurn));
  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, total, wireRadius, 8, false);
}

/** A flat coil of wire lying in the XZ plane (used for solenoids/inductors). */
export function flatCoilGeometry(
  innerRadius: number,
  outerRadius: number,
  turns: number,
  wireRadius: number,
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const total = Math.max(16, Math.floor(turns * 32));
  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    const radius = innerRadius + (outerRadius - innerRadius) * t;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, total, wireRadius, 6, false);
}
