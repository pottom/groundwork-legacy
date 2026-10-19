// Groundwork works without a network: nothing served to the browser loads a resource
// from another host. Plain links in text and comments are allowed; scripts, styles,
// fonts, images and imports must come from the core server (/vendor/... or the module).
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODULES } from './modules.mjs'
import { SHELL_DIR, VENDOR_DIR } from './server.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

// `//` with or without a scheme: https://x, http://x, //x.
const FAR = String.raw`(?:[a-z][a-z0-9+.-]*:)?\/\/`
const RESOURCE = [
  new RegExp(String.raw`<(?:link|script|img|iframe|source|video|audio|embed|object|track|image|use)\b[^>]*?\b(?:src|href|srcset|data|xlink:href)\s*=\s*["']?\s*${FAR}`, 'i'),
  new RegExp(String.raw`(?:\bfrom|\bimport)\s*\(?\s*["'\x60]${FAR}`, 'i'),
  new RegExp(String.raw`\burl\(\s*["']?\s*${FAR}`, 'i'),
  new RegExp(String.raw`@import\s+["']${FAR}`, 'i'),
  new RegExp(String.raw`\b(?:fetch|EventSource|WebSocket|importScripts)\s*\(\s*["'\x60]${FAR}`, 'i'),
]

export function farResources(text) {
  return text.split('\n').flatMap((line, i) => RESOURCE.some((re) => re.test(line)) ? [`${i + 1}: ${line.trim().slice(0, 160)}`] : [])
}

function filesIn(dir, exts) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && exts.includes(path.extname(e.name)))
    .map((e) => path.join(e.parentPath ?? e.path, e.name))
}

function browserFiles() {
  const files = new Set()
  for (const m of MODULES) for (const f of m.view?.files ?? []) files.add(path.join(m.view.dir, f))
  for (const f of filesIn(path.join(ROOT, 'modules'), ['.html'])) files.add(f)
  for (const f of filesIn(VENDOR_DIR, ['.css', '.js', '.mjs', '.html'])) files.add(f)
  for (const f of filesIn(SHELL_DIR, ['.css', '.mjs'])) files.add(f)
  return [...files]
}

test('the check finds resources from another host and lets plain links pass', () => {
  for (const bad of [
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<script src="//cdn.example.com/x.js"></script>',
    '<img alt="" src=http://example.com/a.png>',
    "import MindElixir from 'https://cdn.jsdelivr.net/npm/mind-elixir@5.15.1/dist/MindElixir.js'",
    "const m = await import('https://esm.sh/marked')",
    "import 'https://example.com/side-effect.js'",
    "  src: url(https://fonts.gstatic.com/s/inter.woff2) format('woff2');",
    "@import 'https://example.com/a.css';",
    "fetch('https://api.example.com/x')",
  ]) assert.notDeepEqual(farResources(bad), [], bad)
  for (const ok of [
    '<a href="https://lucide.dev">Lucide</a>',
    '// `svg` is a Lucide icon (https://lucide.dev, ISC license).',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
    "import MindElixir from '/vendor/mind-elixir/MindElixir.js'",
    "import { STATUSES } from './node-types.mjs'",
    '<link rel="stylesheet" href="/vendor/fonts.css">',
    'src: url(./fonts/inter/inter-latin-wght-normal.woff2)',
    "url(\"data:image/svg+xml,...\")",
  ]) assert.deepEqual(farResources(ok), [], ok)
})

// The one known exception, exact and in one file: Excalidraw's template for an embedded tweet
// (a srcdoc that would load Twitter's script). It runs only when a tweet is embedded, and the
// Sketch page turns embeds off (modules/sketch/view/board.mjs), so it never runs.
const KNOWN = {
  [path.join('core', 'vendor', 'excalidraw', 'excalidraw.production.min.js')]:
    '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"><\\/script>',
}

test('no file served to the browser loads anything from another host', () => {
  const files = browserFiles()
  assert.ok(files.some((f) => f.endsWith(path.join('ideas', 'index.html'))))
  assert.ok(files.some((f) => f.endsWith(path.join('plan', 'index.html'))))
  assert.ok(files.some((f) => f.endsWith(path.join('build', 'index.html'))))
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    let text = fs.readFileSync(f, 'utf8')
    if (KNOWN[rel]) {
      assert.equal(text.split(KNOWN[rel]).length, 2, `${rel} has its known exception exactly once`)
      text = text.replace(KNOWN[rel], '')
    }
    assert.deepEqual(farResources(text), [], rel)
  }
})

test('every bundled dependency is recorded with its version and license', () => {
  const readme = fs.readFileSync(path.join(VENDOR_DIR, 'README.md'), 'utf8')
  for (const [dir, name, version] of [
    ['mind-elixir', 'mind-elixir', '5.15.1'],
    ['marked', 'marked', '12.0.2'],
    ['fonts/inter', '@fontsource-variable/inter', '5.3.0'],
    ['fonts/source-serif-4', '@fontsource-variable/source-serif-4', '5.3.1'],
    ['excalidraw', '@excalidraw/excalidraw', '0.17.6'],
    ['react', 'react', '18.3.1'],
    ['react-dom', 'react-dom', '18.3.1'],
  ]) {
    assert.match(readme, new RegExp(`\\|\\s*\`${name.replace(/[/@-]/g, '\\$&')}\`\\s*\\|\\s*${version.replace(/\./g, '\\.')}\\s*\\|`), name)
    assert.ok(fs.readdirSync(path.join(VENDOR_DIR, dir)).some((f) => /^LICENSE/.test(f)), `${dir} has its LICENSE`)
  }
})
