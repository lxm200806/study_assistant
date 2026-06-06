/**
 * Lightweight last-resort sanitizer for free-chat replies.
 * The primary guard is the prompt itself; this only catches clear runaway cases.
 */

// Sentence-level signals that a reply has flipped into drill/tutor mode.
const DRILL_MARKERS = [
  /let'?s (practice|try|use) (the word|this word|a word)/i,
  /can you (make|try|use) a sentence with/i,
  /\bKET word\b/i,
  /make a (short )?sentence with/i,
  /try (using )?["""'].+["""'] in a sentence/i,
]

/**
 * Returns true if the reply looks like it has shifted into vocabulary-drill mode.
 */
function hasDrillSegment(text: string): boolean {
  return DRILL_MARKERS.some(re => re.test(text))
}

/**
 * Attempt to trim off the drill portion that starts mid-reply.
 * If the whole reply is a drill, fall back to a generic friendly response.
 */
export function sanitizeFreeChatReply(reply: string, _userMsg?: string): string {
  if (!reply) return reply
  if (!hasDrillSegment(reply)) return reply

  // Try to cut at the first sentence that triggers a drill marker
  const sentences = reply.split(/(?<=[.!?])\s+/)
  const goodSentences = sentences.filter(s => !DRILL_MARKERS.some(re => re.test(s)))

  if (goodSentences.length > 0) {
    return goodSentences.join(' ').trim()
  }

  return "Sounds good! What else have you been up to?"
}
