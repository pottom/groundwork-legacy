// Small HTTP helpers shared by the core server and the modules' endpoints.
//
//   send(res, code, body, type?)               data: never cached (no-store); body a string, Buffer or JSON
//   sendCached(req, res, body, type, opts?)    a page or file the browser may keep: an ETag, a 304 when
//                                              it still has it, compressed (br, gzip) when it accepts that
//   sendFile(req, res, file, { vendor })      sendCached for a file, with its cachePolicy; read again
//                                              only when it changed
//   cachePolicy(file, { vendor })              { maxAge }: how many seconds the browser may use its copy
//                                              without asking. A font is kept a week; a bundled library
//                                              (vendor: under /vendor/, changed only by a release) five
//                                              minutes; anything else 0 (no-cache: it asks every time
//                                              and gets a 304 while nothing changed), as a checkout
//                                              changes its files without changing its version.

import fs from 'node:fs'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

// Sends a string or Buffer (as `type`) or anything else as JSON, never to be cached. The browser
// is told not to guess another type (nosniff). To a HEAD request Node sends the headers only.
// Text of 1 KB or more goes compressed when the request accepts it (res.req: the request), with a
// quick setting, as data is compressed anew each time.
export function send(res, code, body, type = TYPES['.json']) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')
  const compress = COMPRESSIBLE.test(type) && data.length >= MIN_COMPRESS
  const encoding = compress ? acceptedEncoding(res.req) : null
  const out = encoding === 'br'
    ? zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length } })
    : encoding === 'gzip' ? zlib.gzipSync(data, { level: 6 }) : data
  res.writeHead(code, {
    'content-type': type, 'content-length': out.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    ...(compress ? { vary: 'accept-encoding' } : {}), ...(encoding ? { 'content-encoding': encoding } : {}),
  })
  res.end(out)
}

// Worth compressing: text, at least a little of it (woff2 and images are compressed already).
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/
const MIN_COMPRESS = 1024
const acceptedEncoding = (req) => {
  const accepts = String(req?.headers?.['accept-encoding'] || '')
  return /\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : null
}
const FONT_MAX_AGE = 7 * 24 * 3600
const VENDOR_MAX_AGE = 300
const compressedBodies = new Map()   // ETag -> { br, gzip }: each body is compressed once
const MAX_COMPRESSED = 256

export const cachePolicy = (file, { vendor = false } = {}) => ({ maxAge: file.endsWith('.woff2') ? FONT_MAX_AGE : vendor ? VENDOR_MAX_AGE : 0 })

// The body compressed with `encoding`, kept by its hash.
function compressed(body, hash, encoding) {
  let p = compressedBodies.get(hash)
  if (!p) {
    if (compressedBodies.size >= MAX_COMPRESSED) compressedBodies.delete(compressedBodies.keys().next().value)
    compressedBodies.set(hash, (p = {}))
  }
  return (p[encoding] ??= encoding === 'br'
    ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : zlib.gzipSync(body, { level: 9 }))
}

const hashOf = (body) => crypto.createHash('sha1').update(body).digest('hex').slice(0, 20)

// The tags an If-None-Match header names, without W/ and without the encoding suffix.
const ifNoneMatchTags = (header = '') => header.split(',').map((t) => t.trim().replace(/^W\//, '').replace(/^"([^"-]*)(-\w+)?"$/, '$1'))

export function sendCached(req, res, body, type, { maxAge = 0, hash } = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
  hash ??= hashOf(data)
  const compress = COMPRESSIBLE.test(type) && data.length >= MIN_COMPRESS
  const encoding = compress ? acceptedEncoding(req) : null
  const headers = {
    'content-type': type,
    'cache-control': maxAge ? `max-age=${maxAge}` : 'no-cache',
    etag: `"${hash}${encoding ? '-' + encoding : ''}"`,
    'x-content-type-options': 'nosniff',
    ...(compress ? { vary: 'accept-encoding' } : {}),
  }
  if (ifNoneMatchTags(req.headers['if-none-match']).includes(hash)) {
    res.writeHead(304, headers)
    return res.end()
  }
  const out = encoding ? compressed(data, hash, encoding) : data
  res.writeHead(200, { ...headers, ...(encoding ? { 'content-encoding': encoding } : {}), 'content-length': out.length })
  res.end(out)
}

const read = new Map()   // path -> { mtimeMs, size, data, hash }

export function sendFile(req, res, file, { vendor = false } = {}) {
  const st = fs.statSync(file)
  let f = read.get(file)
  if (!f || f.mtimeMs !== st.mtimeMs || f.size !== st.size) {
    const data = fs.readFileSync(file)
    f = { mtimeMs: st.mtimeMs, size: st.size, data, hash: hashOf(data) }
    read.set(file, f)
  }
  const type = TYPES[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream'
  sendCached(req, res, f.data, type, { ...cachePolicy(file, { vendor }), hash: f.hash })
}

const MAX_BODY = 20 * 1024 * 1024

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > MAX_BODY) { reject(new Error('request body too large')); req.destroy() }
    })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}
