/**
 * Entry point.
 *
 * Boots the lab into `#app`. Kept deliberately tiny: everything interesting
 * lives in `App`, and the world is built at runtime rather than shipped as
 * binary assets.
 */

import './styles/main.css';
import { App } from '@/app/App';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Virtual Physics Lab: no #app element to mount into.');
}

const app = new App(container);

// Expose the instance for quick console tinkering while developing.
if (import.meta.env.DEV) {
  (window as unknown as { lab: App }).lab = app;
}
