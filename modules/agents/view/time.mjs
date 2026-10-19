// Times on the Agents page, the same in every language.
//
//   duration(ms)   '0:42', '3:05', '1:02:03' (m:ss, or h:mm:ss from an hour on)
//   clock(iso)     the local time of day, '14:05:09'

export function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const two = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`
}

export function clock(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
