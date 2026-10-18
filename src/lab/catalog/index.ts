/**
 * The equipment catalogue.
 *
 * Every item a student can take off the shelf is described here: what it is,
 * which topic it belongs to, and how to build its 3D model. Keeping the
 * catalogue in one place means the sidebar, the search box and the
 * experiments all agree about what exists.
 *
 * To add apparatus: write a builder in `src/engine/models/*`, then add an
 * entry below. Nothing else needs to change.
 */

import type { EquipmentDefinition, GroupId } from '../types';

import { MECHANICS_EQUIPMENT } from './mechanics';
import { OPTICS_EQUIPMENT } from './optics';
import { ELECTRICITY_EQUIPMENT } from './electricity';
import { MAGNETISM_EQUIPMENT } from './magnetism';

/** Every definition, in sidebar order. */
export const CATALOG: readonly EquipmentDefinition[] = [
  ...MECHANICS_EQUIPMENT,
  ...OPTICS_EQUIPMENT,
  ...ELECTRICITY_EQUIPMENT,
  ...MAGNETISM_EQUIPMENT,
];

const byId = new Map<string, EquipmentDefinition>(CATALOG.map((definition) => [definition.id, definition]));

/** Look up a definition by id (throws if it does not exist — a coding error). */
export function getEquipment(id: string): EquipmentDefinition {
  const definition = byId.get(id);
  if (!definition) throw new Error(`Unknown equipment id: ${id}`);
  return definition;
}

/** Look up a definition, returning undefined instead of throwing. */
export function findEquipment(id: string): EquipmentDefinition | undefined {
  return byId.get(id);
}

/** All definitions in a group. */
export function equipmentInGroup(group: GroupId): EquipmentDefinition[] {
  return CATALOG.filter((definition) => definition.group === group);
}

/** Simple fuzzy search over name, summary and keywords. */
export function searchEquipment(query: string): EquipmentDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...CATALOG];
  const terms = q.split(/\s+/);
  return CATALOG.filter((definition) => {
    const haystack = [definition.name, definition.summary, definition.group, ...(definition.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
