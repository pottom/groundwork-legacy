// @ts-check
// A record's Markdown as HTML, for a page to show: anyone may edit a record without the tool (a
// teammate, an agent), so it is shown and never run. Raw HTML in it shows as text, a link goes only
// to http(s), mailto or a relative address (anything else is its text alone), and an image is its
// alt text, so the page loads nothing from it. Uses the bundled marked (core/vendor/marked, v12).
//
//   renderMarkdown(text)  -> the HTML string

import { Marked } from '../vendor/marked/marked.esm.js'

/** @param {unknown} s */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const EXTERNAL = /^(https?:|mailto:)/i

/** The address to use, or null. Browsers drop blanks in a URL, so the scheme is checked without them. @param {unknown} href */
function safeHref(href) {
  const url = String(href ?? '').trim()
  const bare = url.replace(/[\x00-\x20\x7f]/g, '')
  if (EXTERNAL.test(bare)) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || /^[/\\][/\\]/.test(bare)) return null
  return url
}

const marked = new Marked({
  breaks: false,
  renderer: {
    /** @param {string} text @param {boolean} block */
    html: (text, block) => (block ? `<p>${esc(text.trim())}</p>\n` : esc(text)),
    /** @param {string} href @param {string | null} title @param {string} text */
    link(href, title, text) {
      const url = safeHref(href)
      if (url == null) return text
      const away = EXTERNAL.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}${away}>${text}</a>`
    },
    /** @param {string} _href @param {string | null} _title @param {string} text */
    image: (_href, _title, text) => esc(text),
  },
})

/** @param {string} text @returns {string} */
export const renderMarkdown = (text) => /** @type {string} */ (marked.parse(String(text ?? '')))
