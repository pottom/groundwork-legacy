// How the Agents page renders an agent's final report with marked: the options for
// `new Marked(MARKDOWN_OPTIONS)`. An agent wrote the report, so it is shown and never run: raw
// HTML in it shows as text, a link goes only to http(s), mailto or a relative address (anything
// else is its text alone), and an image is its alt text, so the page loads nothing from it.
// Written for marked v12's renderer (core/vendor/marked).

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const EXTERNAL = /^(https?:|mailto:)/i

// The address to use, or null. Browsers drop blanks in a URL, so the scheme is checked without
// them; "//host" and "/\host" lead to another host.
function safeHref(href) {
  const url = String(href ?? '').trim()
  const bare = url.replace(/[\x00-\x20\x7f]/g, '')
  if (EXTERNAL.test(bare)) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || /^[/\\][/\\]/.test(bare)) return null
  return url
}

export const MARKDOWN_OPTIONS = {
  breaks: false,
  renderer: {
    html: (text, block) => (block ? `<p>${esc(text.trim())}</p>\n` : esc(text)),
    link(href, title, text) {
      const url = safeHref(href)
      if (url == null) return text
      const away = EXTERNAL.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${esc(url)}"${title ? ` title="${title}"` : ''}${away}>${text}</a>`
    },
    image: (href, title, text) => text,
  },
}
