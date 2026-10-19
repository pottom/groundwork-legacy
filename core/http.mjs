// Small HTTP helpers shared by the core server and the modules' endpoints.
//
//   send(res, code, body, type?)               data: never cached (no-store); body a string, Buffer or JSON
//   sendCached(req, res, body, type, opts?)    a page or file the browser may keep: an ETag, a 304 when
//                                              it still has it, compressed (br, gzip) when it accepts that
//   sendFile(req, res, file, opts?)            sendCached for a file; read again only when it changed
//
// opts.maxAge: how many seconds the browser may use its copy without asking (default 0: no-cache,
// it asks every time and gets a 304 while nothing changed); opts.immutable: kept for good, for a URL
// that names its version.

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
export function send(res, code, body, type = TYPES['.json']) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')
  res.writeHead(code, { 'content-type': type, 'content-length': data.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(data)
}

// Worth compressing: text, at least a little of it (woff2 and images are compressed already).
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/
const MIN_COMPRESS = 1024
const YEAR = 31536000
const packed = new Map()   // ETag -> { br, gzip }: each body is compressed once
const MAX_PACKED = 256

function variant(body, hash, encoding) {
  let p = packed.get(hash)
  if (!p) {
    if (packed.size >= MAX_PACKED) packed.delete(packed.keys().next().value)
    packed.set(hash, (p = {}))
  }
  return (p[encoding] ??= encoding === 'br'
    ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : zlib.gzipSync(body, { level: 9 }))
}

const hashOf = (body) => crypto.createHash('sha1').update(body).digest('hex').slice(0, 20)

// The tags an If-None-Match header names, without W/ and without the encoding suffix.
const named = (header = '') => header.split(',').map((t) => t.trim().replace(/^W\//, '').replace(/^"([^"-]*)(-\w+)?"$/, '$1'))

export function sendCached(req, res, body, type, { maxAge = 0, immutable = false, hash } = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
  hash ??= hashOf(data)
  const accepts = String(req.headers['accept-encoding'] || '')
  const compress = COMPRESSIBLE.test(type) && data.length >= MIN_COMPRESS
  const encoding = !compress ? null : /\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : null
  const headers = {
    'content-type': type,
    'cache-control': immutable ? `max-age=${YEAR}, immutable` : maxAge ? `max-age=${maxAge}` : 'no-cache',
    etag: `"${hash}${encoding ? '-' + encoding : ''}"`,
    'x-content-type-options': 'nosniff',
    ...(compress ? { vary: 'accept-encoding' } : {}),
  }
  if (named(req.headers['if-none-match']).includes(hash)) {
    res.writeHead(304, headers)
    return res.end()
  }
  const out = encoding ? variant(data, hash, encoding) : data
  res.writeHead(200, { ...headers, ...(encoding ? { 'content-encoding': encoding } : {}), 'content-length': out.length })
  res.end(out)
}

const read = new Map()   // path -> { mtimeMs, size, data, hash }

export function sendFile(req, res, file, opts) {
  const st = fs.statSync(file)
  let f = read.get(file)
  if (!f || f.mtimeMs !== st.mtimeMs || f.size !== st.size) {
    const data = fs.readFileSync(file)
    f = { mtimeMs: st.mtimeMs, size: st.size, data, hash: hashOf(data) }
    read.set(file, f)
  }
  const type = TYPES[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream'
  sendCached(req, res, f.data, type, { ...opts, hash: f.hash })
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
