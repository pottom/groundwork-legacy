// How Plan's documents panel renders Markdown with marked (view/document.mjs): the options for
// `new Marked(MARKDOWN_OPTIONS)`. The text comes from the map and the documents, which Claude and
// the people of the project write, so it is shown and never run: raw HTML in it shows as text,
// and a link or an image goes only to http(s), mailto or a relative address (anything else is
// its text alone). Written for marked v12's renderer (core/vendor/marked).

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const EXTERNAL = /^(https?:|mailto:)/i
const withoutBlanks = (s) => s.replace(/[\x00-\x20\x7f]/g, '')

// The address to use, or null. Browsers drop tabs, newlines and leading spaces in a URL, so the
// scheme is checked without them; "//host" and "/\host" lead to another host.
export function safeHref(href) {
  const url = String(href ?? '').trim()
  const bare = withoutBlanks(url)
  if (EXTERNAL.test(bare)) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || /^[/\\][/\\]/.test(bare)) return null
  return url
}

// marked hands over the title and an image's text escaped already, a link's text rendered.
const titleAttr = (title) => (title ? ` title="${title}"` : '')

export const MARKDOWN_OPTIONS = {
  breaks: false,
  renderer: {
    html: (text, block) => (block ? `<p>${esc(text.trim())}</p>\n` : esc(text)),
    link(href, title, text) {
      const url = safeHref(href)
      if (url == null) return text
      const away = EXTERNAL.test(withoutBlanks(url)) ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${esc(url)}"${titleAttr(title)}${away}>${text}</a>`
    },
    image(href, title, text) {
      const url = safeHref(href)
      return url == null ? text : `<img src="${esc(url)}" alt="${text}"${titleAttr(title)}>`
    },
  },
}
