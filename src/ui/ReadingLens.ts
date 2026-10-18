/**
 * The reading lens: a magnified view of a rule with a movable reading cursor.
 *
 * This is the component that turns "the simulation knows the answer" into
 * "the student has to read the scale". It draws:
 *  - the graduations of the real metre rule (1 mm minor, 5 mm mid, 1 cm major),
 *  - a silhouette of whatever is being measured (bob, cork, pointer...),
 *  - a draggable reading line the student aligns by eye,
 *  - the parallax displacement, because the silhouette is drawn where the
 *    student's eye *sees* it from the current camera position, not where it is.
 */

import { h } from './widgets';

export interface LensMarker {
  /** Apparent height above the bench, in metres (parallax already applied). */
  apparentHeightM: number;
  /** Radius of the silhouette in metres; 0 draws only a line. */
  radiusM: number;
  /** Silhouette fill colour. */
  colour: string;
  /** Caption shown beside the silhouette. */
  label: string;
}

export interface ReadingLensOptions {
  /** Height of the panel in CSS pixels. */
  heightPx?: number;
  /** How much of the rule the window shows, in metres. */
  windowHeightM?: number;
  /** Smallest graduation, in metres (0.001 = 1 mm). */
  minorDivisionM?: number;
  /** Called whenever the cursor moves to a new reading. */
  onCursorMove?: (heightM: number) => void;
}

export class ReadingLens {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;

  /** Centre of the visible window, in metres above the bench. */
  #windowCentreM: number;
  readonly #windowHeightM: number;
  readonly #minorDivisionM: number;
  #cursorM = 0;
  #marker: LensMarker | null = null;
  #onCursorMove: ((heightM: number) => void) | null;
  #dragging = false;
  #heightPx: number;

  constructor(options: ReadingLensOptions = {}) {
    const { heightPx = 320, windowHeightM = 0.07, minorDivisionM = 0.001, onCursorMove } = options;
    this.#heightPx = heightPx;
    this.#windowHeightM = windowHeightM;
    this.#minorDivisionM = minorDivisionM;
    this.#windowCentreM = windowHeightM / 2;
    this.#onCursorMove = onCursorMove ?? null;

    this.canvas = h('canvas', { class: 'pl-lens__canvas' }) as HTMLCanvasElement;
    this.canvas.style.height = `${heightPx}px`;

    this.root = h(
      'div',
      { class: 'pl-lens' },
      this.canvas,
      h(
        'div',
        { class: 'pl-lens__footer' },
        h('span', { class: 'pl-lens__hint' }, 'Drag the reading line to the centre of the mark'),
      ),
    );

    this.#bindPointer();
    this.resize();
  }

  /** Redraw with the current device pixel ratio. */
  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.root.clientWidth || 260;
    this.canvas.width = Math.max(120, Math.round(width * ratio));
    this.canvas.height = Math.round(this.#heightPx * ratio);
    const ctx = this.canvas.getContext('2d');
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.render();
  }

  /** Set (or clear) the silhouette being measured. */
  setMarker(marker: LensMarker | null): void {
    this.#marker = marker;
    this.render();
  }

  setCursor(heightM: number): void {
    this.#cursorM = heightM;
    this.render();
  }

  get cursorHeightM(): number {
    return this.#cursorM;
  }

  get windowCentreM(): number {
    return this.#windowCentreM;
  }

  /** Move the visible window so the given height is in the middle. */
  centreOn(heightM: number): void {
    this.#windowCentreM = heightM;
    this.render();
  }

  /** Scroll the window, keeping it within the rule. */
  scrollBy(deltaM: number): void {
    this.#windowCentreM = Math.max(this.#windowHeightM / 2, Math.min(1 - this.#windowHeightM / 2, this.#windowCentreM + deltaM));
    this.render();
  }

  onCursorMove(callback: (heightM: number) => void): void {
    this.#onCursorMove = callback;
  }

  // -------------------------------------------------------------------------

  #bindPointer(): void {
    const toHeight = (clientY: number): number => {
      const rect = this.canvas.getBoundingClientRect();
      const fraction = (clientY - rect.top) / rect.height;
      const top = this.#windowCentreM + this.#windowHeightM / 2;
      return top - fraction * this.#windowHeightM;
    };

    const onDown = (event: PointerEvent): void => {
      this.#dragging = true;
      this.#cursorM = toHeight(event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
      this.render();
      this.#onCursorMove?.(this.#cursorM);
    };
    const onMove = (event: PointerEvent): void => {
      if (!this.#dragging) return;
      this.#cursorM = toHeight(event.clientY);
      this.render();
      this.#onCursorMove?.(this.#cursorM);
    };
    const onUp = (event: PointerEvent): void => {
      this.#dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);
    this.canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        this.scrollBy((event.deltaY / 800) * this.#windowHeightM);
      },
      { passive: false },
    );
  }

  #heightToY(heightM: number, drawHeight: number): number {
    const top = this.#windowCentreM + this.#windowHeightM / 2;
    return ((top - heightM) / this.#windowHeightM) * drawHeight;
  }

  render(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.width / ratio;
    const height = this.canvas.height / ratio;

    // --- Rule body ---------------------------------------------------------
    ctx.fillStyle = '#f3ead2';
    ctx.fillRect(0, 0, width, height);

    // The graduations occupy the right-hand two thirds, like a real rule.
    const graduationsLeft = width * 0.32;

    const minorPx = (this.#minorDivisionM / this.#windowHeightM) * height;
    ctx.strokeStyle = '#1b1b1b';
    const startHeight = Math.ceil((this.#windowCentreM - this.#windowHeightM / 2) / this.#minorDivisionM) * this.#minorDivisionM;
    const endHeight = this.#windowCentreM + this.#windowHeightM / 2;

    for (let value = startHeight; value <= endHeight + 1e-9; value += this.#minorDivisionM) {
      const millimetres = Math.round(value * 1000);
      const isMajor = millimetres % 10 === 0;
      const isMid = !isMajor && millimetres % 5 === 0;
      const y = this.#heightToY(value, height);
      const tickLength = isMajor ? width * 0.34 : isMid ? width * 0.2 : width * 0.12;

      ctx.lineWidth = isMajor ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(graduationsLeft, y);
      ctx.lineTo(graduationsLeft + tickLength, y);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#1b1b1b';
        ctx.font = `600 ${Math.min(18, Math.max(10, minorPx * 2.4))}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(millimetres / 10), graduationsLeft - 4, y);
      }
    }

    // --- Silhouette being measured ----------------------------------------
    if (this.#marker) {
      const markerY = this.#heightToY(this.#marker.apparentHeightM, height);
      const radiusPx = Math.max(3, (this.#marker.radiusM / this.#windowHeightM) * height);

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = this.#marker.colour;
      ctx.beginPath();
      ctx.arc(graduationsLeft + radiusPx * 0.2, markerY, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The fiducial mark on the object itself.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(graduationsLeft + radiusPx * 0.2, markerY, Math.max(1.2, radiusPx * 0.13), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(30,30,30,0.75)';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(this.#marker.label, 6, Math.min(height - 16, markerY + radiusPx + 3));
    }

    // --- Reading cursor ----------------------------------------------------
    const cursorY = this.#heightToY(this.#cursorM, height);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cursorY);
    ctx.lineTo(width, cursorY);
    ctx.stroke();

    // Handle on the left edge.
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(0, cursorY - 7);
    ctx.lineTo(11, cursorY);
    ctx.lineTo(0, cursorY + 7);
    ctx.closePath();
    ctx.fill();

    // Live reading of the cursor.
    const readingCm = this.#cursorM * 100;
    const label = `${readingCm.toFixed(2)} cm`;
    ctx.font = '700 13px "Consolas", monospace';
    const textWidth = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(225,29,72,0.94)';
    ctx.beginPath();
    ctx.roundRect(width - textWidth - 4, cursorY - 20, textWidth, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width - textWidth / 2 - 4, cursorY - 11);
  }

  dispose(): void {
    this.root.remove();
  }
}
