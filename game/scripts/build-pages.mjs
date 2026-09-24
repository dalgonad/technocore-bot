import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const publicEntries = ['index.html', 'styles.css', 'styles-panels.css', 'src', 'assets'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of publicEntries) {
  await cp(new URL(entry, root), new URL(entry, output), { recursive: true });
}
await writeFile(new URL('.nojekyll', output), '');
console.log('GitHub Pages files packaged in game/dist/');
