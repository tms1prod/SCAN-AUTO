import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = join(projectDir, 'www');
const assets = ['style.css', 'script.js', 'service-worker.js', 'manifest.webmanifest', 'auto-scan.svg'];

await mkdir(outputDir, { recursive: true });
for (const asset of assets) {
  await copyFile(join(projectDir, asset), join(outputDir, asset));
}
await cp(join(projectDir, 'icons'), join(outputDir, 'icons'), { recursive: true });
await rm(join(outputDir, 'manifest.json'), { force: true });

const html = await readFile(join(projectDir, 'ind.html'), 'utf8');
await writeFile(join(outputDir, 'index.html'), html);
await writeFile(join(outputDir, 'ind.html'), html);
console.log(`Auto Scan web build ready in ${outputDir}`);