const BLOCKLIST_PATTERNS = [
  {
    reason: 'HATE_OR_SLUR',
    // High-risk slurs and hate terms should never be echoed back.
    regex: /\b(nigger|faggot|kike|spic|chink|tranny)\b/i,
  },
  {
    reason: 'SELF_HARM_ENCOURAGEMENT',
    regex: /\b(kill yourself|kys|go die|commit suicide)\b/i,
  },
  {
    reason: 'VIOLENT_THREAT',
    regex: /\b(i will kill you|i(?:\'| a)?m going to kill you|i will hurt you)\b/i,
  },
  {
    reason: 'DOXXING_OR_PII',
    regex: /\b(address|phone number|social security|ssn|credit card|doxx|doxing)\b/i,
  },
  {
    reason: 'SEXUAL_EXPLICIT',
    regex: /\b(rape|child porn|cp\b|sexual assault)\b/i,
  },
]

function sanitizeReply(reply) {
  if (typeof reply !== 'string') return ''
  return reply.replace(/\s+/g, ' ').trim()
}

function moderateReply(reply) {
  const clean = sanitizeReply(reply)

  for (const rule of BLOCKLIST_PATTERNS) {
    if (rule.regex.test(clean)) {
      return {
        blocked: true,
        reason: rule.reason,
        safeReply: 'That crosses the slime line. Keep it Twitch-safe.',
      }
    }
  }

  return {
    blocked: false,
    reason: null,
    safeReply: clean,
  }
}

module.exports = { moderateReply }
