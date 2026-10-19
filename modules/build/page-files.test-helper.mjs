// The Build page's own source files, for the tests that read the page: the skeleton (index.html),
// its styles (build.css) and its ES modules (page/**/*.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILD_DIR = path.dirname(fileURLToPath(import.meta.url));

// The page's modules, as paths relative to modules/build/ ("page/views/git.mjs").
export const pageModules = () => fs.readdirSync(path.join(BUILD_DIR, 'page'), { recursive: true })
  .map((f) => 'page/' + String(f).split(path.sep).join('/'))
  .filter((f) => f.endsWith('.mjs'))
  .sort();

// Line endings depend on the checkout (core.autocrlf): read without them.
export const readBuild = (rel) => fs.readFileSync(path.join(BUILD_DIR, rel), 'utf8').replace(/\r\n/g, '\n');

// Every source file of the page, one after the other.
export const pageSource = () => ['index.html', 'build.css', ...pageModules()].map(readBuild).join('\n');
