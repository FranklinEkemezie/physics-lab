/**
 * Domain types for the lab: what equipment exists, how it is grouped, and
 * what a "placed" item on the bench looks like.
 */

import type * as THREE from 'three';

/** The four practical groupings used in the sidebar. */
export type GroupId = 'mechanics' | 'optics' | 'electricity' | 'magnetism';

export interface GroupDefinition {
  id: GroupId;
  label: string;
  /** One-line description shown under the heading. */
  blurb: string;
  /** Emoji/glyph for the tab. */
  glyph: string;
  /** Accent colour used for the tab and the cards inside it. */
  accent: string;
}

export const GROUPS: readonly GroupDefinition[] = [
  {
    id: 'mechanics',
    label: 'Mechanics',
    blurb: 'Motion, forces, timing and measurement.',
    glyph: '⚙️',
    accent: '#5aa9e6',
  },
  {
    id: 'optics',
    label: 'Optics',
    blurb: 'Reflection, refraction, lenses and images.',
    glyph: '🔭',
    accent: '#8bc34a',
  },
  {
    id: 'electricity',
    label: 'Electricity',
    blurb: 'Circuits, current, voltage and resistance.',
    glyph: '⚡',
    accent: '#f2a73b',
  },
  {
    id: 'magnetism',
    label: 'Magnetism',
    blurb: 'Fields, poles, induction and compasses.',
    glyph: '🧲',
    accent: '#e05a5a',
  },
] as const;

/**
 * A catalogue entry: metadata plus the recipe for building the 3D model.
 * Definitions are stateless — {@link Lab} calls `build()` once per spawn.
 */
export interface EquipmentDefinition {
  /** Stable, kebab-case identifier used in save files and experiments. */
  id: string;
  /** Display name. */
  name: string;
  /** Which sidebar group it belongs to. */
  group: GroupId;
  /** One-line description for the picker card. */
  summary: string;
  /** Emoji glyph for the picker card. */
  glyph: string;
  /** Extra search terms. */
  keywords?: string[];
  /** Approximate bench footprint radius in metres (used for auto-placement). */
  footprintM?: number;
  /** How the item responds to being dragged (defaults to `bench`). */
  dragMode?: 'bench' | 'vertical' | 'custom' | 'none';
  /** Build a fresh instance. Called once per placed object. */
  build(): THREE.Object3D;
}

/** What the lab emits whenever the pointer interacts with the scene. */
export interface DragEvent {
  instanceId: string;
  object: THREE.Object3D;
  /** New world position after the drag step (unchanged for `custom` drags). */
  position: THREE.Vector3;
  /**
   * Where the pointer ray met the drag plane, in world space. For `custom`
   * drags this is the only meaningful coordinate — the object is not moved by
   * the Lab and the experiment decides what to do with the point.
   */
  pointerPoint: THREE.Vector3;
  /** True while the pointer button is still down. */
  active: boolean;
}

/** A live object on the bench. */
export interface PlacedObject {
  instanceId: string;
  definitionId: string;
  object: THREE.Object3D;
}
