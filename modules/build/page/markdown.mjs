// A small Markdown renderer for what the tickets and documents use, to an HTML string that the
// drawer shows through lit's unsafeHTML: the one place the page writes HTML from text. Every
// piece of source text goes through esc() before it becomes HTML; raw HTML in the markdown is
// shown as text. Links to a document of the project open it in the drawer; #12 and "core 3" become
// ticket links.

import { reader } from './config.mjs';
import { ui, statusName } from './text.mjs';
import { docHref } from './state.mjs';

const { isClosed } = reader;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const lead = (l) => l.length - l.trimStart().length;
const isOrdered = (m) => /\d/.test(m[2]);
const isBlockStart = (l) => /^\s*(#{1,6}\s|```|~~~|>)/.test(l) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

// The same link as the views' ticketLink (parts.mjs), as a string.
const ticketLink = (t, text) => `<a class="gw-tag tref${isClosed(t) ? ' is-closed' : ''}" href="${docHref(t.path)}" data-doc="${esc(t.path)}" title="${esc(t.title + ' · ' + statusName(t.status))}">${esc(text || t.label)}</a>`;

function splitRow(line) {
  const cells = [];
  let cur = '', code = false;
  const s = line.trim().replace(/^\|/, '').replace(/\|\s*$/, (m0, off, str) => (str[off - 1] === '\\' ? m0 : ''));
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '`') code = !code;
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|' && !code) { cells.push(cur.trim()); cur = ''; } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

// ctx: { path: the document's path, model: the ticket reader's model }.
export function renderMarkdown(text, ctx) {
  return renderBlocks(text.replace(/\r\n?/g, '\n').replace(/[\u0001\u0002]/g, '').replace(/\t/g, '    ').split('\n'), ctx);
}

function renderBlocks(lines, ctx) {
  const out = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    // A line that starts a "**Field:** value" pair keeps its own line.
    const joined = para.map((l, i) => (i && (/^\*\*[^*]+:\*\*/.test(l.trim()) || /( {2}|\\)$/.test(para[i - 1])) ? '\u0001br\u0002' : i ? ' ' : '') + l.trim().replace(/\\$/, '')).join('');
    out.push('<p>' + renderInline(joined.replace(/\u0001br\u0002/g, '\n'), ctx).replace(/\n/g, '<br>') + '</p>');
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { flush(); i++; continue; }

    const fence = /^(\s*)(```+|~~~+)(.*)$/.exec(line);
    if (fence) {
      flush();
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s*' + fence[2][0] + '{' + fence[2].length + ',}\\s*$').test(lines[i])) body.push(lines[i++].slice(Math.min(fence[1].length, lead(lines[i - 1]))));
      i++;
      out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${renderInline(h[2], ctx)}</h${h[1].length}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && (/^\s*>/.test(lines[i]) || (lines[i].trim() && body.length && !isBlockStart(lines[i]) && !LIST_ITEM.test(lines[i])))) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + renderBlocks(body, ctx) + '</blockquote>');
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]) && lines[i + 1].includes('-') && lines[i + 1].includes('|')) {
      flush();
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${renderInline(c, ctx)}</${tag}>`;
      let table = '<div class="tw"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) table += '<tr>' + splitRow(lines[i++]).map((c, k) => cell('td', c, k)).join('') + '</tr>';
      out.push(table + '</tbody></table></div>');
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li) {
      flush();
      i = list(lines, i, li, ctx, out);
      continue;
    }
    para.push(line);
    i++;
    if (i < lines.length && (isBlockStart(lines[i]) || LIST_ITEM.test(lines[i]))) flush();
  }
  flush();
  return out.join('\n');
}

// A list from line i (its first item li): its HTML goes to out; the line after it is returned.
function list(lines, i, li, ctx, out) {
  const base = li[1].length, ordered = isOrdered(li);
  const start = ordered ? parseInt(li[2], 10) : 1;
  const items = [];
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (!m || m[1].length < base || m[1].length >= base + 2 || isOrdered(m) !== ordered) break;
    const inner = m[1].length + m[2].length + 1;
    const body = [m[3]];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && lead(lines[j]) >= base + 2) { body.push(''); i++; continue; }
        break;
      }
      if (lead(l) >= base + 2) { body.push(l.slice(Math.min(lead(l), inner))); i++; continue; }
      if (LIST_ITEM.test(l) || isBlockStart(l)) break;
      body.push(l.trim());
      i++;
    }
    items.push(body);
    let j = i;
    while (j < lines.length && !lines[j].trim()) j++;
    const next = j > i && j < lines.length ? LIST_ITEM.exec(lines[j]) : null;
    if (next && next[1].length >= base && next[1].length < base + 2 && isOrdered(next) === ordered) i = j;
  }
  const tag = ordered ? 'ol' : 'ul';
  out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>` + items.map((body) => {
    const task = /^\[( |x|X)\]\s+(.*)$/.exec(body[0]);
    if (task) body = [task[2], ...body.slice(1)];
    let item = renderBlocks(body, ctx);
    const single = /^<p>([\s\S]*?)<\/p>/.exec(item);
    if (single) item = single[1] + item.slice(single[0].length);
    if (!task) return '<li>' + item + '</li>';
    const checked = task[1] !== ' ';
    return `<li class="task${checked ? ' done' : ''}"><input type="checkbox" disabled${checked ? ' checked' : ''} aria-label="${esc(ui(checked ? 'md.done' : 'md.not-done'))}"><span class="t">${item}</span></li>`;
  }).join('') + `</${tag}>`);
  return i;
}

function resolvePath(from, href) {
  const parts = from.split('/').slice(0, -1);
  for (const seg of href.split('/')) {
    if (seg === '..') { if (!parts.length) return null; parts.pop(); } else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function renderLink(url, inner, ctx) {
  if (/^(https?:|mailto:)/i.test(url)) return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//')) return inner;
  let target = url.replace(/[#?].*$/, '');
  try { target = decodeURIComponent(target); } catch (e) { /* keep as written */ }
  const path = target.startsWith('/') ? target.slice(1) : resolvePath(ctx.path, target);
  if (path && ctx.model.byPath.has(path)) return `<a href="${docHref(path)}" data-doc="${esc(path)}">${inner}</a>`;
  return `<span class="dead" title="${esc(ui('md.dead-link', { url }))}">${inner}</span>`;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\w\\])__(?=\S)([\s\S]+?)(?<=\S)__(?!\w)/g, '<strong>$1</strong>')
    .replace(/\*(?=[^\s*])([^*\n]+?)(?<=\S)\*/g, '<em>$1</em>')
    .replace(/(?<![\w\\])_(?=[^\s_])([^_\n]+?)(?<=\S)_(?!\w)/g, '<em>$1</em>')
    .replace(/~~(?=\S)([^~\n]+?)(?<=\S)~~/g, '<del>$1</del>');
}

function ticketRefs(s, ctx) {
  const m = ctx.model;
  s = s.replace(/(^|[^\w&/#])#(\d{1,6})(?![\w#])/g, (all, pre, num) => {
    const t = m.resolveIssue(+num);
    return t && t.path !== ctx.path ? pre + ticketLink(t) : all;
  });
  if (m.areaRef) s = s.replace(m.areaRef, (all, pre, whole, areaName, num) => {
    const t = m.resolveLocal(areaName, +num);
    return t && t.path !== ctx.path ? pre + ticketLink(t, whole) : all;
  });
  return s;
}

function renderInline(src, ctx, noLinks) {
  const stash = [];
  const keep = (part) => '\u0001' + (stash.push(part) - 1) + '\u0002';
  let s = src;
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => keep('<code>' + esc(code.trim() || code) + '</code>'));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, (m, ch) => keep(esc(ch)));
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (m, alt) => keep('<span class="dead">' + esc(ui('md.image', { alt: alt || ui('md.image-unnamed') })) + '</span>'));
  if (!noLinks) {
    s = s.replace(/\[([^\]\n]+)\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/g, (m, label, url) => keep(renderLink(url, renderInline(label, ctx, true), ctx)));
    s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (m, url) => keep(renderLink(url, esc(url), ctx)));
    s = s.replace(/\bhttps?:\/\/[^\s<>()\u0001]*[^\s<>().,;:!?"'\u0001„”]/g, (url) => keep(renderLink(url, esc(url), ctx)));
  }
  s = emphasis(esc(s));
  if (!noLinks) s = ticketRefs(s, ctx);
  for (let guard = 0; guard < 6 && s.includes('\u0001'); guard++) s = s.replace(/\u0001(\d+)\u0002/g, (m, k) => stash[+k] ?? '');
  return s;
}
