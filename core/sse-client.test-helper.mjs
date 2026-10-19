// A small Server-Sent Events client for the tests: listens to the core's /api/events.
//
//   const sse = listen(port)          sse.ready: the response; sse.next(match): the next event
//   await sse.change('plan.map')      the next `change` event naming that topic

import http from 'node:http'

// An SSE client: the events as they arrive ({ event, data }), and the raw text.
export function listen(port, { host = '127.0.0.1' } = {}) {
  const got = []
  const waiters = []
  let raw = ''
  let response
  const req = http.get({ host: '127.0.0.1', port, path: '/api/events', headers: { host: `${host}:${port}`, accept: 'text/event-stream' } })
  const ready = new Promise((resolve, reject) => {
    req.on('response', (res) => {
      response = res
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
        let i
        while ((i = raw.indexOf('\n\n')) >= 0) {
          const block = raw.slice(0, i)
          raw = raw.slice(i + 2)
          const ev = { event: 'message', data: '' }
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) ev.event = line.slice(6).trim()
            else if (line.startsWith('data:')) ev.data += line.slice(5).trim()
            else if (line.startsWith('retry:')) ev.retry = Number(line.slice(6))
          }
          got.push(ev)
          for (const w of [...waiters]) w()
        }
      })
      resolve(res)
    })
    req.on('error', reject)
  })
  // Resolves to the first event (from now on, or already received) that `match` accepts.
  const next = (match, ms = 4000) => new Promise((resolve, reject) => {
    const check = () => {
      const hit = got.find(match)
      if (!hit) return false
      got.splice(got.indexOf(hit), 1)
      waiters.splice(waiters.indexOf(check), 1)
      clearTimeout(timer)
      resolve(hit)
      return true
    }
    const timer = setTimeout(() => { waiters.splice(waiters.indexOf(check), 1); reject(new Error('no matching event; got ' + JSON.stringify(got))) }, ms)
    waiters.push(check)
    check()
  })
  const change = (topic, ms) => next((e) => e.event === 'change' && JSON.parse(e.data).topics.includes(topic), ms)
  return { ready, next, change, got, close: () => req.destroy(), get response() { return response } }
}

