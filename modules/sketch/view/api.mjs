// The page's two ways to call the Sketch API (module.mjs): every read and every JSON POST goes
// through these, so a refusal looks the same everywhere.
//
//   getJson(url)          GET, never from the browser's cache -> the JSON answer
//   postJson(url, body)   POST body as application/json (the server refuses anything else, 415)
//   both reject with an Error carrying { status } when the server refuses, so a caller can say why
//   (409 taken, 400 not a plain name)

const refused = (url, res) => Object.assign(new Error(`${url}: ${res.status}`), { status: res.status })

export async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw refused(url, res)
  return res.json()
}

export async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw refused(url, res)
}
