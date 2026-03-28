const { isAdminUser, ADMIN_USERS } = require('../utils/admins')
const { moderateReply } = require('../utils/safety')
const { getFeeling } = require('../utils/userFeelings')
const { getApiJson, postApi } = require('../utils/api')

// Synthetic user scoped to the test run, never a real user.
const TEST_USER_ID = '__glorptest_pipeline__'
const TEST_USERNAME = '__glorptest__'

async function checkMemoryWrite(channelId) {
  try {
    await postApi('memory/glorp', {
      username: TEST_USERNAME,
      userId: TEST_USER_ID,
      channelId,
      question: '[pipeline test probe]',
      reply: '[pipeline test probe reply]',
      delta: 0,
      feeling: 5,
      emotion: 'neutral',
      reason: 'pipeline test',
      safetyBlocked: false,
      safetyReason: null,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 80) }
  }
}

async function checkMemorySummaryRead(channelId) {
  try {
    const result = await getApiJson('memory/user-summary', {
      userId: TEST_USER_ID,
      channelId,
      windowDays: 7,
    })

    const hasGlorp = result && typeof result.glorp === 'object'
    const hasCommands = result && Array.isArray(result.commands)

    if (!hasGlorp || !hasCommands) {
      return {
        ok: false,
        error: `unexpected shape: glorp=${hasGlorp} commands=${hasCommands}`,
      }
    }

    return { ok: true, askCount: Number(result.glorp.total_asks || 0) }
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 80) }
  }
}

function checkSafetyModeration() {
  const EXPECTED_FALLBACK = 'That crosses the slime line. Keep it Twitch-safe.'

  const blockedResult = moderateReply('you should go kill yourself')
  const safeResult = moderateReply('what is the glorpian lore')
  const emptyResult = moderateReply('')

  const issues = []

  if (!blockedResult.blocked) {
    issues.push('unsafe_not_blocked')
  }
  if (blockedResult.safeReply !== EXPECTED_FALLBACK) {
    issues.push('fallback_text_wrong')
  }
  if (safeResult.blocked) {
    issues.push('safe_msg_was_blocked')
  }
  if (safeResult.safeReply !== 'what is the glorpian lore') {
    issues.push('safe_msg_altered')
  }
  if (emptyResult.blocked) {
    issues.push('empty_msg_was_blocked')
  }

  return { ok: issues.length === 0, issues }
}

function checkFeelingState() {
  const score = getFeeling(TEST_USERNAME)
  const isNumber = typeof score === 'number'
  const inRange = score >= 1 && score <= 10

  return { ok: isNumber && inRange, score }
}

function buildReport(label, result) {
  if (result.ok) return `${label}: ✅`
  const detail = result.error || (result.issues ? result.issues.join(',') : 'failed')
  return `${label}: ❌ (${detail})`
}

module.exports = {
  execute: async (client, channel, tags) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, glorppipelinetest is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    const rawChannel = channel.startsWith('#') ? channel.slice(1) : channel
    const startedAt = Date.now()

    client.say(channel, `@${tags.username}, running pipeline probe… hold thy slime.`)

    try {
      const [writeResult, readResult] = await Promise.all([
        checkMemoryWrite(rawChannel),
        checkMemorySummaryRead(rawChannel),
      ])

      const moderationResult = checkSafetyModeration()
      const feelingResult = checkFeelingState()

      const elapsed = Date.now() - startedAt
      const lines = [
        buildReport('memory_write', writeResult),
        buildReport('memory_read', readResult),
        buildReport('safety_moderation', moderationResult),
        buildReport('feeling_state', feelingResult),
      ]

      const allPassed = [writeResult, readResult, moderationResult, feelingResult].every(
        (r) => r.ok,
      )
      const statusEmoji = allPassed ? '✅' : '⚠️'

      client.say(
        channel,
        `@${tags.username} ${statusEmoji} pipeline probe (${elapsed}ms): ${lines.join(' | ')}`,
      )
    } catch (err) {
      console.error('❌ glorpPipelineTest error:', err)
      client.say(channel, `@${tags.username}, pipeline test threw an unexpected error. Check logs.`)
    }
  },
}
