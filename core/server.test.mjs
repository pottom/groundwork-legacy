// Tests of the core server: binding, the Host check, and routing to modules.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from './server.mjs'
import { shellPage } from './shell/shell.mjs'
import { SHELL_STRINGS } from './shell/strings.mjs'

function fakeModule(viewDir) {
  return {
    id: 'demo', name: 'Demo', version: '1.2.3',
    view: { dir: viewDir, files: ['index.html'] },
    api: ({ root }) => (req, res, sub) => {
      if (sub === '/hello') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ root, sub })); return true }
      return false
    },
  }
}

async function withServer(fn) {
  const viewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-view-'))
  fs.writeFileSync(path.join(viewDir, 'index.html'), '<h1>demo view</h1>')
  fs.writeFileSync(path.join(viewDir, 'secret.txt'), 'not listed')
  const srv = await startServer({ root: '/project', modules: [fakeModule(viewDir)], port: 0 })
  try { await fn(srv) } finally { await srv.close() }
}

// Two modules with views and one without, in a project folder with a name that needs escaping.
async function withShell(fn) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-shell-')), 'my <project>')
  const view = (id, name) => ({ id, name, version: '1', view: { dir: root, files: ['index.html'] } })
  const modules = [view('one', 'First'), view('two', 'Second & more'), { id: 'headless', name: 'Headless', version: '1' }]
  const srv = await startServer({ root, modules, port: 0 })
  try { await fn(srv) } finally { await srv.close() }
}

// A raw request, so the Host header can be anything.
function get(port, pathname, host = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, headers: { host } }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('listens on 127.0.0.1 only', async () => {
  await withServer(async (srv) => {
    assert.equal(srv.address.address, '127.0.0.1')
  })
})

test('a foreign Host header gets 403', async () => {
  await withServer(async ({ port }) => {
    assert.equal((await get(port, '/api/demo/hello', 'evil.example.com')).status, 403)
    assert.equal((await get(port, '/api/demo/hello', `evil.example.com:${port}`)).status, 403)
    assert.equal((await get(port, '/demo/', '192.168.1.10')).status, 403)
  })
})

test('localhost and 127.0.0.1 Host headers are accepted', async () => {
  await withServer(async ({ port }) => {
    assert.equal((await get(port, '/api/demo/hello', `localhost:${port}`)).status, 200)
    assert.equal((await get(port, '/api/demo/hello', `127.0.0.1:${port}`)).status, 200)
  })
})

test('module endpoints are under /api/<module>/ and get the project root', async () => {
  await withServer(async ({ port }) => {
    const r = await get(port, '/api/demo/hello')
    assert.deepEqual(JSON.parse(r.body), { root: '/project', sub: '/hello' })
    assert.equal((await get(port, '/api/demo/missing')).status, 404)
    assert.equal((await get(port, '/api/nobody/hello')).status, 404)
  })
})

test('the module list shows each manifest', async () => {
  await withServer(async ({ port }) => {
    const r = await get(port, '/api/modules')
    assert.deepEqual(JSON.parse(r.body), [{ id: 'demo', name: 'Demo', version: '1.2.3', path: '/demo/' }])
  })
})

test('the view is served under /<module>/, only its listed files', async () => {
  await withServer(async ({ port }) => {
    assert.equal((await get(port, '/demo')).status, 301)
    const r = await get(port, '/demo/')
    assert.equal(r.status, 200)
    assert.match(r.body, /demo view/)
    assert.equal((await get(port, '/demo/secret.txt')).status, 404)
    assert.equal((await get(port, '/demo/..%2fserver.mjs')).status, 404)
  })
})

test('the bundled dependencies are served under /vendor/', async () => {
  await withServer(async ({ port }) => {
    const js = await get(port, '/vendor/marked/marked.esm.js')
    assert.equal(js.status, 200)
    assert.match(js.headers['content-type'], /^text\/javascript/)
    const css = await get(port, '/vendor/fonts.css')
    assert.equal(css.status, 200)
    assert.match(css.headers['content-type'], /^text\/css/)
    const font = await get(port, '/vendor/fonts/inter/inter-latin-wght-normal.woff2')
    assert.equal(font.status, 200)
    assert.equal(font.headers['content-type'], 'font/woff2')
  })
})

test('/vendor/ refuses paths outside the folder, dot files, folders and unserved types', async () => {
  await withServer(async ({ port }) => {
    for (const p of [
      '/vendor/..%2fserver.mjs', '/vendor/..%5cserver.mjs', '/vendor/%2e%2e%2fserver.mjs',
      '/vendor/marked/..%2f..%2fserver.mjs', '/vendor/%2fetc%2fpasswd', '/vendor/C:%5cWindows%5cwin.ini',
      '/vendor/', '/vendor/marked', '/vendor/README.md', '/vendor/marked/LICENSE.md', '/vendor/missing.js',
      '/vendor/%E0%A4%A',
    ]) assert.equal((await get(port, p)).status, 404, p)
  })
})

test('the start page is the shell: the project name in the header, the first module inside', async () => {
  await withShell(async ({ port }) => {
    const r = await get(port, '/')
    assert.equal(r.status, 200)
    assert.match(r.headers['content-type'], /^text\/html/)
    assert.match(r.body, /<header[^>]*>[\s\S]*my &lt;project&gt;[\s\S]*<\/header>/)
    assert.match(r.body, /<iframe[^>]*src="\/one\/"/)
  })
})

// The shared style variables modules may use; theme.css documents each.
const COLOURS = ['--gw-bg', '--gw-surface', '--gw-sunken', '--gw-fg', '--gw-fg-2', '--gw-muted', '--gw-line', '--gw-line-strong',
  '--gw-accent', '--gw-accent-fg', '--gw-focus', '--gw-ok', '--gw-warn', '--gw-bad', '--gw-shadow']
const SHAPES = ['--gw-font', '--gw-font-serif', '--gw-font-mono', '--gw-text', '--gw-text-small', '--gw-radius', '--gw-space', '--gw-header-height']

test('the shell serves its theme, and every page of it uses the theme', async () => {
  await withShell(async ({ port }) => {
    const page = (await get(port, '/')).body
    for (const href of ['/shell/theme.css', '/shell/shell.css']) {
      assert.match(page, new RegExp(`<link rel="stylesheet" href="${href}">`))
      const css = await get(port, href)
      assert.equal(css.status, 200, href)
      assert.match(css.headers['content-type'], /^text\/css/)
    }
    assert.equal((await get(port, '/shell/shell.mjs')).status, 404)
    assert.equal((await get(port, '/shell/..%2fserver.mjs')).status, 404)
  })
})

test('the theme defines the shared variables, light by default and dark when the OS asks for it', async () => {
  await withShell(async ({ port }) => {
    const css = (await get(port, '/shell/theme.css')).body
    const block = (re) => { const m = re.exec(css); assert.ok(m, String(re)); return m[1] }
    const light = block(/^:root\s*\{([^}]*)\}/m)
    const dark = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)
    assert.match(light, /color-scheme:\s*light dark/)
    for (const v of [...COLOURS, ...SHAPES]) assert.match(light, new RegExp(`${v}:`), `light ${v}`)
    for (const v of COLOURS) assert.match(dark, new RegExp(`${v}:`), `dark ${v}`)
    assert.match(css, /@import url\('\/vendor\/fonts\.css'\)/)
  })
})

// The data-i18n keys a page marks, with the attribute variants.
const i18nKeys = (html) => [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1])

test('the shell shows its text in English and marks every string for translation, with a Hungarian set', async () => {
  await withShell(async ({ port }) => {
    const page = (await get(port, '/')).body
    assert.match(page, /<html lang="en">/)
    assert.match(page, /<nav class="gw-nav" aria-label="Modules" data-i18n-aria-label="nav"/)
    const empty = shellPage({ project: 'p', modules: [], active: null })
    assert.match(empty, /<p class="gw-empty" data-i18n="noView">No module has a view\.<\/p>/)
    const keys = [...new Set([...i18nKeys(page), ...i18nKeys(empty)])]
    assert.ok(keys.length >= 3, keys.join())
    for (const k of keys) {
      assert.ok(SHELL_STRINGS.en[k], `en ${k}`)
      assert.ok(SHELL_STRINGS.hu[k] && SHELL_STRINGS.hu[k] !== SHELL_STRINGS.en[k], `hu ${k}`)
    }
  })
})

test('the shell has a language picker and serves the translation module to its pages', async () => {
  await withShell(async ({ port }) => {
    const page = (await get(port, '/')).body
    assert.match(page, /<select class="gw-lang"[^>]*>\s*<option value="en">English<\/option>\s*<option value="hu">Magyar<\/option>/)
    assert.match(page, /import \{ createI18n \} from '\/shell\/i18n\.mjs'/)
    for (const js of ['/shell/i18n.mjs', '/shell/strings.mjs']) {
      const r = await get(port, js)
      assert.equal(r.status, 200, js)
      assert.match(r.headers['content-type'], /javascript/)
    }
  })
})

test('a module may not take an id the core uses for its own paths', async () => {
  for (const id of ['api', 'shell', 'vendor']) {
    await assert.rejects(startServer({ root: '/project', modules: [{ id, name: id, version: '1' }], port: 0 }), /reserved/, id)
  }
})

test('the navigation lists every module with a view, from the manifests, and opens each', async () => {
  await withShell(async ({ port }) => {
    const nav = /<nav[^>]*>([\s\S]*?)<\/nav>/.exec((await get(port, '/')).body)[1]
    const links = [...nav.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]])
    assert.deepEqual(links, [['/?module=one', 'First'], ['/?module=two', 'Second &amp; more']])
    const two = (await get(port, '/?module=two')).body
    assert.match(two, /<iframe[^>]*src="\/two\/"/)
    assert.match(two, /<a href="\/\?module=two" aria-current="page">/)
    assert.doesNotMatch(two, /<a href="\/\?module=one" aria-current/)
    assert.match((await get(port, '/?module=nobody')).body, /<iframe[^>]*src="\/one\/"/)
  })
})

test('each module gets a writer for the folders its manifest names, and only those', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-root-'))
  let files
  const mod = { id: 'demo', name: 'Demo', version: '1', writes: ['.groundwork/demo'], api: (ctx) => { files = ctx.files; return () => false } }
  const srv = await startServer({ root, modules: [mod], port: 0 })
  try {
    files.write('.groundwork/demo/state.json', '{}')
    assert.equal(fs.readFileSync(path.join(root, '.groundwork/demo/state.json'), 'utf8'), '{}')
    assert.throws(() => files.write('docs/product/x.md', 'x'), /may not write/)
    assert.throws(() => files.write('../x.md', 'x'), /may not write/)
  } finally {
    await srv.close()
  }
})
