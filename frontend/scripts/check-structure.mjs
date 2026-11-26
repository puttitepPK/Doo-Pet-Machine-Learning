import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sources = walk(path.join(root, 'src')).filter(f => /\.(jsx?|css)$/.test(f));
const graph = new Map();
let imports = 0;
let images = 0;
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  const edges = [];
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    assert.ok(fs.existsSync(target), `Missing import ${match[1]} in ${file}`);
    edges.push(target);
    imports++;
  }
  graph.set(file, edges);
  for (const match of text.matchAll(/['"](\/(?:images|dogs|avatars|about)\/[^'"\n]+)['"]/g)) {
    if (match[1].endsWith('/')) continue; // Legacy URL directory translations.
    assert.ok(fs.existsSync(path.join(root, 'public', match[1])), `Missing static asset ${match[1]} in ${file}`);
    images++;
  }
}
const active = new Set();
const visited = new Set();
function visit(file) {
  assert.ok(!active.has(file), `Circular import at ${file}`);
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file) || []) visit(target);
  active.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
console.log(`Structure OK: ${imports} relative imports, ${images} static asset references, no circular imports.`);
