// From an engineering idea to a ticket that links back (d-ideas-ticket-line), shared by the page and
// the tests. Claude makes the ticket (the groundwork-ideas skill); the ticket names the idea on an
// "**Idea:** I-12" line among its first lines, Build reads that line and shows the idea as a link, and
// Build's GET /api/build/ideas tells the card which tickets name it.
//
//   canMakeTicket(idea)   true for an engineering idea in Accepted: the card offers "Make a ticket"
//   ticketPrompt(idea)    the ready prompt the card copies for Claude

export const canMakeTicket = (idea) => idea.kind === 'engineering' && idea.status === 'accepted'

export function ticketPrompt(idea) {
  const lines = [
    `Make a GitHub issue from idea ${idea.id} of the idea box (the groundwork-ideas skill, "Making a ticket from an idea").`,
    `Read the idea first: its file under docs/product/ideas/.`,
    `Put this line among the first lines of the issue body, so Build links the ticket to the idea:`,
    '',
    `**Idea:** ${idea.id}`,
    '',
    `The idea: ${idea.title}`,
  ]
  if (idea.body) lines.push('', idea.body)
  const estimate = [idea.impact && `impact ${idea.impact}`, idea.effort && `effort ${idea.effort}`].filter(Boolean).join(', ')
  if (estimate) lines.push('', `Estimate: ${estimate}${idea.rationale ? ` (${idea.rationale})` : ''}.`)
  if (idea.source) lines.push(`Source: ${idea.source}.`)
  return lines.join('\n') + '\n'
}
