/**
 * A reusable "screen": an offscreen canvas that can be redrawn on demand and
 * used as a texture on a 3D panel.
 *
 * Digital stopwatches, multimeters, signal generators and oscilloscope screens
 * all need live text in the scene. Rather than a texture per instrument this
 * class gives every one of them the same cheap drawing surface.
 */

import * as THREE from 'three';

export type PanelDrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export class CanvasPanel {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  readonly width: number;
  readonly height: number;

  constructor(width = 512, height = 256) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** Redraw the panel. Only call this when the content actually changes. */
  update(draw: PanelDrawFn): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    draw(ctx, this.width, this.height);
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  /**
   * A material showing this panel.
   * @param emissive When true the panel glows (backlit LCD / CRT screen).
   */
  material(emissive = true): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      map: this.texture,
      toneMapped: !emissive,
      transparent: true,
    });
  }

  dispose(): void {
    this.texture.dispose();
  }
}

/**
 * Seven-segment-ish digits. Real LCDs have that blocky, slightly gappy look;
 * we mimic it with a monospaced font and a faint "ghost" layer so unlit
 * segments are still just visible.
 */
export function drawLcdDigits(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    color?: string;
    ghostColor?: string;
    align?: CanvasTextAlign;
    bold?: boolean;
    letterSpacing?: number;
  },
): void {
  const {
    x,
    y,
    size,
    color = '#101a12',
    ghostColor = 'rgba(16,26,18,0.07)',
    align = 'center',
    bold = true,
    letterSpacing = 0,
  } = options;

  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Courier New", "Consolas", monospace`;

  if (letterSpacing !== 0) {
    // Canvas has no letterSpacing in every browser, so draw glyph by glyph.
    const chars = [...text];
    const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + letterSpacing, 0) - letterSpacing;
    let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    ctx.fillStyle = ghostColor;
    for (const ch of chars) {
      if (ch !== ' ') ctx.fillText(ch, cursor, y + size * 0.02);
      cursor += ctx.measureText(ch).width + letterSpacing;
    }
    ctx.fillStyle = color;
    cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const ch of chars) {
      if (ch !== ' ') ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + letterSpacing;
    }
    return;
  }

  ctx.fillStyle = ghostColor;
  ctx.fillText(text, x, y + size * 0.02);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Softly shaded "bezelled" panel background, so displays sit inside their
 * instrument rather than floating on top of it.
 */
export function drawBezel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: { radius?: number; fill?: string; inset?: string } = {},
): void {
  const { radius = 16, fill = '#c9d2c4', inset = 'rgba(255,255,255,0.35)' } = options;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.fill();
  ctx.strokeStyle = inset;
  ctx.lineWidth = Math.max(1, height * 0.01);
  ctx.beginPath();
  ctx.roundRect(ctx.lineWidth, ctx.lineWidth, width - ctx.lineWidth * 2, height - ctx.lineWidth * 2, radius);
  ctx.stroke();
}
