// From an engineering idea to a ticket that links back (d-ideas-ticket-line), shared by the page and
// the tests. Claude makes the ticket (the groundwork-ideas skill); the ticket names the idea on an
// "**Idea:** I-12" line among its first lines, Build reads that line and shows the idea as a link, and
// Build's GET /api/build/ideas tells the card which tickets name it. An idea with a change (the one
// accepting it opened, d-direct-ticket) has its ticket name the change too, on a "**Change:** C-7" line.
//
//   canMakeTicket(idea)   true for an idea in Accepted whose latest change is implementing (the
//                         Straight to a ticket route, or a grilled change once approved), or an
//                         engineering one accepted before changes, with none: the card offers "Make a
//                         ticket". An idea sent down the Grilling route waits for its interview
//                         (d-route-choice: the kind only gives the default)
//   ticketPrompt(idea)    the ready prompt the card copies for Claude, and the board after a
//                         Straight to a ticket accept; it names the idea's latest change (idea.changes)

const changeOfIdea = (idea) => idea.changes?.at(-1) ?? null

export const canMakeTicket = (idea) => idea.status === 'accepted'
  && (changeOfIdea(idea) ? changeOfIdea(idea).status === 'implementing' : idea.kind === 'engineering')

export function ticketPrompt(idea) {
  const change = changeOfIdea(idea)
  const lines = [
    `Make a GitHub issue from idea ${idea.id} of the idea box (the groundwork-ideas skill, "Making a ticket from an idea").`,
    change
      ? `Read the idea first: its file under docs/product/ideas/, and the change it opened, ${change.id}, under docs/product/changes/.`
      : `Read the idea first: its file under docs/product/ideas/.`,
    change
      ? `Put these lines among the first lines of the issue body, so Build links the ticket to the idea and the change:`
      : `Put this line among the first lines of the issue body, so Build links the ticket to the idea:`,
    '',
    `**Idea:** ${idea.id}`,
    ...(change ? [`**Change:** ${change.id}`] : []),
    '',
    `The idea: ${idea.title}`,
  ]
  if (idea.body) lines.push('', idea.body)
  const estimate = [idea.impact && `impact ${idea.impact}`, idea.effort && `effort ${idea.effort}`].filter(Boolean).join(', ')
  if (estimate) lines.push('', `Estimate: ${estimate}${idea.rationale ? ` (${idea.rationale})` : ''}.`)
  if (idea.source) lines.push(`Source: ${idea.source}.`)
  return lines.join('\n') + '\n'
}
