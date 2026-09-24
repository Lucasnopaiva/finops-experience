import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import { companies, participants } from '../src/data.js';

const output = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const assets = {};

function addDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) addDirectory(filename);
    else if (entry.isFile()) {
      const key = '/' + relative(output, filename).split('\\').join('/');
      assets[key] = { type: mime[extname(filename)] || 'application/octet-stream', base64: readFileSync(filename).toString('base64') };
    }
  }
}

addDirectory(output);
mkdirSync(join(output, 'server'), { recursive: true });
writeFileSync(join(output, 'server', 'index.js'), `const ASSETS = ${JSON.stringify(assets)};\nconst SEED_GUESTS = ${JSON.stringify(participants)};\nconst SEED_COMPANIES = ${JSON.stringify(companies)};\n${readFileSync(resolve('worker/index.js'), 'utf8')}`);
