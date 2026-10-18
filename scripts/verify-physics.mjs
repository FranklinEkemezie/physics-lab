/**
 * Run the physics self-checks (`scripts/physics-check.ts`) with no build step.
 *
 * The source uses the `@/` path alias and TypeScript, so we bundle it in-memory
 * with esbuild (already present as a Vite dependency) and evaluate the result.
 * Nothing is written to disk.
 */

import { build } from 'esbuild';

/** Turn a `file:///C:/...` pathname into a Windows-style path for esbuild. */
const toPath = (url) => url.pathname.replace(/^\/([A-Za-z]:)/, '$1');

const entry = toPath(new URL('./physics-check.ts', import.meta.url));
const aliasRoot = toPath(new URL('../src', import.meta.url));

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  alias: { '@': aliasRoot },
  logLevel: 'warning',
});

const code = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const { runChecks } = await import(moduleUrl);

const checks = runChecks();
let failed = 0;
for (const check of checks) {
  const mark = check.pass ? '\u2713' : '\u2717';
  if (!check.pass) failed += 1;
  console.log(`${mark} ${check.name}\n    ${check.detail}`);
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
