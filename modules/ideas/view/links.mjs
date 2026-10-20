// An idea's links to Plan's map: a link that is not an idea (I-3), a ticket (#42) or an address is a
// map node, and opens Plan with that node focused. Ideas never writes the map.
//
//   mapLinks(idea)  [{ id, href }] the idea's links that are map nodes, with Plan's deep link
//   planLink(id)    the address that opens Plan with that node focused

export const planLink = (id) => '/?module=plan&node=' + encodeURIComponent(id)

const NOT_A_NODE = /^(I-\d+|#\d+|[a-z][\w+.-]*:|\/)/i

export const mapLinks = (idea) => (idea.links ?? []).filter((l) => !NOT_A_NODE.test(l)).map((id) => ({ id, href: planLink(id) }))
