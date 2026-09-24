import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const run = promisify(execFile);

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listFiles(new URL(`${entry.name}/`, directory), `${name}/`));
    } else {
      assert.equal(entry.isFile(), true, `Unexpected link in Pages output: ${name}`);
      files.push(name);
    }
  }
  return files.sort();
}

test('Pages packaging removes stale files and publishes only the unchanged game runtime', async () => {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('stale.txt', output), 'Do not publish');
  await run(process.execPath, [fileURLToPath(new URL('scripts/build-pages.mjs', root))]);

  const files = await listFiles(output);
  assert.deepEqual(files, [
    '.nojekyll',
    'assets/hero.webp',
    'assets/items.webp',
    'assets/logo.webp',
    'assets/plant.webp',
    'assets/robot.webp',
    'assets/villagers.webp',
    'index.html',
    'src/app.js',
    'src/clock.js',
    'src/core.js',
    'src/data.js',
    'src/pointer.js',
    'src/renderer.js',
    'src/world.js',
    'styles-panels.css',
    'styles.css',
  ]);
  for (const file of files.filter(file => file !== '.nojekyll')) {
    assert.deepEqual(await readFile(new URL(file, output)), await readFile(new URL(file, root)), file);
  }
  assert.equal(await readFile(new URL('.nojekyll', output), 'utf8'), '');
});
