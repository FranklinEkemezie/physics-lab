/** DOM primitives shared by every widget helper. */

export type ClassValue = string | false | null | undefined;

/** Create an element with attributes, classes and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') {
      element.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value as Partial<CSSStyleDeclaration>);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(element.dataset, value as Record<string, string>);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'html') {
      element.innerHTML = String(value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}
