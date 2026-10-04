/*
 * Builds this standalone UI preview at /ver-4/.
 * This repository uses its own Worker and does not deploy the team website.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Comments stripped, so a `LATEST` written inside one cannot be read as code. */
function sourceWithoutComments(file) {
  return readFileSync(file, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const worker = sourceWithoutComments(join(root, 'worker', 'index.ts'));
const declared = /\bconst\s+LATEST\s*=\s*['"]ver-(\d+)['"]/.exec(worker);
if (!declared) {
  throw new Error("worker/index.ts must declare const LATEST = 'ver-N'");
}

const version = 'ver-4';
const outDir = `releases/${version}`;

console.log(`building ${version} for the standalone UI preview`);

for (const step of [
  ['node', ['scripts/mapbox-config.mjs', 'public']],
  ['npx', ['tsc', '-b']],
  ['npx', ['vite', 'build', `--base=/${version}/`, '--outDir', outDir, '--emptyOutDir']],
  // Last, so the version directory cannot keep the copy Vite inherits from
  // public/ — a frozen release must not carry deployment configuration.
  ['node', ['scripts/mapbox-config.mjs', 'releases']],
]) {
  const [command, args] = step;
  const run = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
