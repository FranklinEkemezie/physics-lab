/**
 * The equipment sidebar: everything you can take off the shelf.
 *
 * Grouped by physics topic (mechanics, optics, electricity, magnetism) with a
 * search box, because a real lab store has both.
 */

import { h } from './widgets';
import { GROUPS } from '@/lab/types';
import type { EquipmentDefinition, GroupId } from '@/lab/types';
import { equipmentInGroup, searchEquipment } from '@/lab/catalog';

export interface SidebarCallbacks {
  /** The student clicked an item: put it on the bench. */
  onAdd: (definition: EquipmentDefinition) => void;
  /** The student double-clicked an item: add it and focus the camera. */
  onAddAndFocus: (definition: EquipmentDefinition) => void;
  /** Clear the whole bench. */
  onClearBench: () => void;
}

export class Sidebar {
  readonly root: HTMLElement;
  #list: HTMLElement;
  #search: HTMLInputElement;
  #activeGroup: GroupId | 'all' = 'all';
  #query = '';
  #callbacks: SidebarCallbacks;
  #tabButtons = new Map<GroupId | 'all', HTMLButtonElement>();

  constructor(callbacks: SidebarCallbacks) {
    this.#callbacks = callbacks;

    this.#search = h('input', {
      class: 'pl-sidebar__search',
      type: 'search',
      placeholder: 'Search apparatus…  (rule, bob, magnet)',
      'aria-label': 'Search apparatus',
    }) as HTMLInputElement;

    const tabs = h('div', { class: 'pl-sidebar__tabs', role: 'tablist' });
    for (const [id, label, glyph] of [
      ['all', 'All', '🧪'],
      ...GROUPS.map((group) => [group.id, group.label, group.glyph] as const),
    ] as const) {
      const button = h(
        'button',
        { class: 'pl-sidebar__tab', type: 'button', role: 'tab', 'data-group': id },
        h('span', { class: 'pl-sidebar__tab-glyph' }, glyph),
        h('span', { class: 'pl-sidebar__tab-label' }, label),
      );
      button.addEventListener('click', () => this.setGroup(id as GroupId | 'all'));
      this.#tabButtons.set(id as GroupId | 'all', button);
      tabs.append(button);
    }

    this.#list = h('div', { class: 'pl-sidebar__list' });

    const footer = h(
      'div',
      { class: 'pl-sidebar__footer' },
      h('p', { class: 'pl-sidebar__hint' }, 'Click an item to place it on the bench · double-click to zoom in'),
    );

    this.root = h(
      'aside',
      { class: 'pl-sidebar' },
      h(
        'header',
        { class: 'pl-sidebar__head' },
        h('h2', { class: 'pl-sidebar__title' }, 'Apparatus store'),
        this.#search,
      ),
      tabs,
      this.#list,
      footer,
    );

    this.#search.addEventListener('input', () => {
      this.#query = this.#search.value;
      this.render();
    });

    this.setGroup('all');
  }

  setGroup(group: GroupId | 'all'): void {
    this.#activeGroup = group;
    for (const [id, button] of this.#tabButtons) {
      const active = id === group;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    }
    this.render();
  }

  render(): void {
    const searching = this.#query.trim().length > 0;
    const items: { group: GroupId; definitions: EquipmentDefinition[] }[] = searching
      ? [{ group: 'mechanics', definitions: searchEquipment(this.#query) }]
      : this.#activeGroup === 'all'
        ? GROUPS.map((group) => ({ group: group.id, definitions: equipmentInGroup(group.id) }))
        : [{ group: this.#activeGroup, definitions: equipmentInGroup(this.#activeGroup) }];

    this.#list.replaceChildren();

    let total = 0;
    for (const section of items) {
      if (section.definitions.length === 0) continue;
      total += section.definitions.length;

      if (!searching) {
        const meta = GROUPS.find((group) => group.id === section.group);
        this.#list.append(
          h(
            'div',
            { class: 'pl-sidebar__group', style: { '--pl-accent': meta?.accent ?? '#5aa9e6' } },
            h('span', { class: 'pl-sidebar__group-glyph' }, meta?.glyph ?? ''),
            h(
              'div',
              { class: 'pl-sidebar__group-text' },
              h('span', { class: 'pl-sidebar__group-title' }, meta?.label ?? section.group),
              h('span', { class: 'pl-sidebar__group-blurb' }, meta?.blurb ?? ''),
            ),
            h('span', { class: 'pl-sidebar__group-count' }, String(section.definitions.length)),
          ),
        );
      }

      for (const definition of section.definitions) {
        this.#list.append(this.#card(definition));
      }
    }

    if (total === 0) {
      this.#list.append(h('p', { class: 'pl-sidebar__empty' }, 'Nothing matches that search.'));
    }
  }

  #card(definition: EquipmentDefinition): HTMLElement {
    const group = GROUPS.find((candidate) => candidate.id === definition.group);
    const card = h(
      'button',
      {
        class: 'pl-item',
        type: 'button',
        title: definition.summary,
        style: { '--pl-accent': group?.accent ?? '#5aa9e6' },
      },
      h('span', { class: 'pl-item__glyph' }, definition.glyph),
      h(
        'span',
        { class: 'pl-item__text' },
        h('span', { class: 'pl-item__name' }, definition.name),
        h('span', { class: 'pl-item__summary' }, definition.summary),
      ),
      h('span', { class: 'pl-item__add' }, '+'),
    );
    card.addEventListener('click', () => this.#callbacks.onAdd(definition));
    card.addEventListener('dblclick', () => this.#callbacks.onAddAndFocus(definition));
    return card;
  }

  dispose(): void {
    this.root.remove();
  }
}
