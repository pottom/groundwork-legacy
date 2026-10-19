// The dependency view: the "Blocked by" links as trees, from the tickets nothing blocks down to
// what each one unlocks. The closed blockers of the visible tickets stay in the picture, dimmed:
// they show what has already been unlocked.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { ui, tx } from '../text.mjs';
import { state, matches, visibleTickets, isFree } from '../state.mjs';
import { chip, badge, empty, docLink, ticketLink, ticketLinks, flags } from '../parts.mjs';

export function depsView() {
  const visible = new Set(visibleTickets());
  const nodes = new Set(visible);
  for (const t of visible) for (const b of t.blockers) if (b.ticket && !visible.has(b.ticket) && matches(b.ticket, true)) nodes.add(b.ticket);
  const children = (t) => t.dependents.filter((d) => nodes.has(d));
  const parents = (t) => t.blockers.map((b) => b.ticket).filter((b) => b && nodes.has(b));
  const linked = [...nodes].filter((t) => children(t).length || parents(t).length);
  const placed = new Set();
  const node = (t, path, top) => {
    placed.add(t);
    const loop = path.includes(t);
    const kids = loop ? [] : children(t);
    const others = parents(t).filter((p) => p !== path[path.length - 1]);
    return html`<li class=${top ? 'gw-card' : nothing}><div class="node${visible.has(t) ? '' : ' ctx'}">${ticketLink(t)} ${docLink(t.path, t.title, 'ttl')} ${chip(t.status)}${flags(t)}${loop ? [' ', badge('bad', ui('deps.loop'))] : nothing}${path.length && others.length ? html`<span class="rel">${tx('deps.also-waits', { list: ticketLinks(others) })}</span>` : nothing}</div>${kids.length ? html`<span class="unlocks">${ui('deps.unlocks')}</span><ul>${kids.map((k) => node(k, [...path, t]))}</ul>` : nothing}</li>`;
  };
  const trees = [];
  for (const t of linked) if (!parents(t).length) trees.push(node(t, [], true));
  for (const t of linked) if (!placed.has(t)) trees.push(node(t, [], true));
  const waiting = linked.filter((t) => visible.has(t) && t.blocked).length;
  const free = linked.filter((t) => visible.has(t) && isFree(t)).length;
  const legend = trees.length ? html`<div class="legend"><span>${badge('bad', ui('flag.blocked'))} ${ui('deps.legend-blocked')}</span><span>${badge('ok', ui('flag.free'))} ${ui('deps.legend-free')}</span><span>${ui('deps.legend-dim')}</span></div>` : nothing;
  const lead = [ui('deps.lead'), ' ', state.showClosed || state.status ? '' : ui('deps.lead-closed') + ' ', waiting ? ui('deps.waiting', { n: waiting }) : ui('deps.none-waiting'), free ? ' ' + ui('deps.free', { n: free }) : ''].join('');
  return html`<p class="lead">${lead}</p>${legend}${trees.length ? html`<ul class="tree">${trees}</ul>` : empty('branch', ui('deps.empty'), '')}`;
}
