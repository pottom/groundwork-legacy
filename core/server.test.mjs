// Tests of the core server: binding, the Host check, and routing to modules.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from './server.mjs'

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

test('the start page links every module', async () => {
  await withServer(async ({ port }) => {
    const r = await get(port, '/')
    assert.equal(r.status, 200)
    assert.match(r.body, /href="\/demo\/"/)
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
