// The page's ES modules as one classic script, for the page opened by double click (file://), where
// Chromium loads no ES module: file-bundle.mjs writes page.bundle.js, which index.html loads there.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { bundle, BUNDLE_FILE, ENTRY } from './file-bundle.mjs';

// A few modules in a scratch folder: { 'rel/path.mjs': source }.
function folder(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-bundle-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('the modules become one classic script that runs them in import order', () => {
  const dir = folder({
    'main.mjs': "import { twice, label as name } from './lib/math.mjs';\nimport { greet } from './lib/greet.mjs';\nglobalThis.out.push(greet(name) + ' ' + twice(21));\n",
    'lib/math.mjs': "export const label = 'math';\nexport function twice(n) { return n * 2; }\nglobalThis.out.push('math');\n",
    'lib/greet.mjs': "import { label } from './math.mjs';\nconst hello = (who) => 'hello ' + who + ' from ' + label;\nexport { hello as greet };\n",
  });
  const code = bundle(path.join(dir, 'main.mjs'));
  assert.doesNotMatch(code, /^\s*(import|export)\b/m, 'no module syntax left');
  const out = [];
  vm.runInNewContext(code, { out });
  assert.deepEqual(out, ['math', 'hello math from math 42']);
});

test('/vendor/ imports come from core/vendor, minified as they are', () => {
  const dir = folder({ 'main.mjs': "import { PartType } from '/vendor/lit-html/directive.js';\nglobalThis.out.push(PartType.CHILD);\n" });
  const out = [];
  vm.runInNewContext(bundle(path.join(dir, 'main.mjs')), { out });
  assert.deepEqual(out, [2]);
});

test('an import cycle is refused: the bundle could not keep live bindings', () => {
  const dir = folder({
    'a.mjs': "import { b } from './b.mjs';\nexport const a = 1;\n",
    'b.mjs': "import { a } from './a.mjs';\nexport const b = 2;\n",
  });
  assert.throws(() => bundle(path.join(dir, 'a.mjs')), /cycle/);
});

test('an import of a name the module does not export is refused', () => {
  const dir = folder({ 'a.mjs': "import { nope } from './b.mjs';\n", 'b.mjs': 'export const b = 2;\n' });
  assert.throws(() => bundle(path.join(dir, 'a.mjs')), /nope/);
});

test('the committed page.bundle.js is the bundle of the page modules as they are now', () => {
  const committed = fs.readFileSync(BUNDLE_FILE, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, bundle(ENTRY), 'run: node modules/build/file-bundle.mjs');
});
