/**
 * The interface: a plain-DOM widget kit plus the panels built from it.
 *
 * There is no UI framework here on purpose. Every widget is an options object
 * with a `root` element, so the panels compose them like Lego, and the same kit
 * can mount into a full page, a sidebar, or a single card in an article.
 */
export * from './DataTable';
export * from './GraphPanel';
export * from './ReadingLens';
export * from './RightPanel';
export * from './Sidebar';
export * from './Toast';
export * from './widgets';
