import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('arxiv-paper-agent');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const files = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
  ...(manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean);

if (manifest.manifest_version !== 3) {
  throw new Error('Expected a Manifest V3 extension.');
}

for (const file of files) {
  const absolute = resolve(root, file);
  const inside = relative(root, absolute);
  if (inside.startsWith('..') || !existsSync(absolute)) {
    throw new Error(`Manifest file missing or outside extension: ${file}`);
  }
}

function findJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'vendor' ? [] : findJs(absolute);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

const scripts = findJs(join(root, 'src'));
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${relative(root, script)} failed syntax check:\n${result.stderr}`);
  }
}

console.log(`Manifest references valid; ${scripts.length} project JavaScript files passed syntax checks.`);
