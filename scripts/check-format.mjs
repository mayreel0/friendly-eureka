import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['apps', 'packages', 'docs', 'plans'];
const extensions = new Set(['.md', '.json', '.ts', '.yaml']);

function extension(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path));
    } else if (extensions.has(extension(path))) {
      files.push(path);
    }
  }
  return files;
}

const files = (await Promise.all(roots.map(collectFiles))).flat();
const missingNewline = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (content.length > 0 && !content.endsWith('\n')) {
    missingNewline.push(file);
  }
}

if (missingNewline.length > 0) {
  console.error(`Files missing trailing newline:\n${missingNewline.join('\n')}`);
  process.exit(1);
}
