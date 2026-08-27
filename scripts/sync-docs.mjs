import { cp, rm, writeFile } from 'node:fs/promises';

const clientBuild = new URL('../dist/client/', import.meta.url);
const docs = new URL('../docs/', import.meta.url);

await rm(docs, { recursive: true, force: true });
await cp(clientBuild, docs, { recursive: true });
await writeFile(new URL('.nojekyll', docs), '');

console.log('GitHub Pages build copied to /docs');
