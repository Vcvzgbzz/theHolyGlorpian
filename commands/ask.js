const { askGPT } = require('../utils/gpt')
const { getErrorMessage } = require('../utils/errors')
const { postApi, getApiJson } = require('../utils/api')
const { moderateReply } = require('../utils/safety')
const { isAdminUser } = require('../utils/admins')
const { updateFeeling } = require('../utils/userFeelings')

const userLastAskAt = new Map()
const usersInFlight = new Set()
const ASK_MAX_CONCURRENT = Number(process.env.ASK_MAX_CONCURRENT) || 1
const ASK_USER_COOLDOWN_MS = Number(process.env.ASK_USER_COOLDOWN_MS) || 1200
const ASK_MEMORY_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.ASK_MEMORY_CACHE_TTL_MS) || 60000,
)
const USER_MOOD_WEIGHT = 0.4
const CHANNEL_MOOD_WEIGHT = 0.6
const LOG_VERBOSE_AI = String(process.env.LOG_VERBOSE_AI || '').toLowerCase() === 'true'
const CHAT_CONTEXT_ENABLED = String(process.env.CHAT_CONTEXT_ENABLED || 'true').toLowerCase() !== 'false'
const ASK_CHAT_BUFFER_LIMIT = Math.max(10, Number(process.env.ASK_CHAT_BUFFER_LIMIT) || 100)
const ASK_CHAT_RECENT_COUNT = Math.max(5, Number(process.env.ASK_CHAT_RECENT_COUNT) || 12)
const ASK_CHAT_RELEVANT_COUNT = Math.max(0, Number(process.env.ASK_CHAT_RELEVANT_COUNT) || 8)
const ASK_CHAT_MAX_CHARS = Math.max(500, Number(process.env.ASK_CHAT_MAX_CHARS) || 1500)
const ASK_ECHO_WINDOW_DAYS = Math.max(1, Number(process.env.ASK_ECHO_WINDOW_DAYS) || 14)
const summaryCache = new Map()
let globalInFlight = 0
let askRequestCounter = 0

const POSITIVE_SIGNAL_WORDS = [
  'nice',
  'thanks',
  'thank',
  'good',
  'great',
  'hype',
  'pog',
  'love',
  'lol',
  'lmao',
  'gg',
  'win',
  'awesome',
  'fun',
]

const NEGATIVE_SIGNAL_WORDS = [
  'hate',
  'stupid',
  'trash',
  'boring',
  'bad',
  'mad',
  'annoying',
  'wtf',
  'cringe',
  'loser',
  'dumb',
  'sucks',
]

function getUserId(tags) {
  return tags['user-id'] || tags.username
}

function isCoolingDown(userId) {
  const last = userLastAskAt.get(userId) || 0
  return Date.now() - last < ASK_USER_COOLDOWN_MS
}

function getCommandCount(summary, commandName) {
  if (!summary || !Array.isArray(summary.commands)) return 0

  const row = summary.commands.find((item) => item.command_name === commandName)
  if (!row) return 0

  const count = Number(row.command_count)
  return Number.isFinite(count) ? count : 0
}

function getSummaryCacheKey(userId, channelId) {
  return `${channelId}:${userId}`
}

function nextAskRequestId() {
  askRequestCounter = (askRequestCounter + 1) % 100000
  return `glorp-${String(askRequestCounter).padStart(5, '0')}`
}

function roundMetric(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Number(num.toFixed(digits))
}

function tokenizeForRelevance(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
  )
}

function sanitizeChatLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreByQuestionRelevance(text, queryTokens) {
  if (!queryTokens || queryTokens.size === 0) return 0

  let score = 0
  const textLower = String(text || '').toLowerCase()
  queryTokens.forEach((token) => {
    if (textLower.includes(token)) score += 1
  })

  return score
}

function normalizeChatRows(messages, maxTextChars = 220) {
  return (Array.isArray(messages) ? messages : [])
    .map((row) => {
      const text = sanitizeChatLine(row?.text)
      if (!text) return null

      return {
        username: String(row?.username || 'unknown').slice(0, 64),
        speakerType: String(row?.speakerType || 'user').toLowerCase() === 'bot' ? 'bot' : 'user',
        text: text.slice(0, maxTextChars),
        twitchServerTs: Number(row?.twitchServerTs || 0),
      }
    })
    .filter(Boolean)
}

function buildSelectedChatContext(messages, question) {
  const cleaned = normalizeChatRows(messages, 220)

  if (cleaned.length === 0) {
    return {
      selected: [],
      meta: {
        sourceCount: 0,
        selectedCount: 0,
        recentCount: 0,
        relevantCount: 0,
      },
    }
  }

  const recent = cleaned.slice(-ASK_CHAT_RECENT_COUNT)
  const queryTokens = tokenizeForRelevance(question)

  const relevantOlder = cleaned
    .slice(0, Math.max(0, cleaned.length - ASK_CHAT_RECENT_COUNT))
    .map((row) => ({
      row,
      score: scoreByQuestionRelevance(row.text, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ASK_CHAT_RELEVANT_COUNT)
    .map((entry) => entry.row)

  const merged = [...relevantOlder, ...recent]
  const uniqueRows = []
  const seen = new Set()
  for (const row of merged) {
    const key = `${row.twitchServerTs}:${row.username}:${row.text}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueRows.push(row)
  }

  let totalChars = 0
  const bounded = []
  for (const row of uniqueRows) {
    const rowChars = row.text.length + row.username.length + 12
    if (totalChars + rowChars > ASK_CHAT_MAX_CHARS) continue
    bounded.push(row)
    totalChars += rowChars
  }

  return {
    selected: bounded,
    meta: {
      sourceCount: cleaned.length,
      selectedCount: bounded.length,
      recentCount: recent.length,
      relevantCount: relevantOlder.length,
      totalChars,
    },
  }
}

function scoreMoodSignalFromText(value) {
  const text = String(value || '').toLowerCase()
  if (!text) return 0

  let score = 0
  for (const word of POSITIVE_SIGNAL_WORDS) {
    if (text.includes(word)) score += 1
  }
  for (const word of NEGATIVE_SIGNAL_WORDS) {
    if (text.includes(word)) score -= 1
  }

  if (text.includes('!') && score > 0) score += 0.25
  if (text.includes('...') && score < 0) score -= 0.25

  return score
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toSmallMoodNudge(value) {
  const normalized = clamp(Number(value || 0), -3, 3)
  if (normalized >= 0.75) return 1
  if (normalized <= -0.75) return -1
  return 0
}

function computeContextMoodNudge(question, moodRows, recentEcho) {
  const rows = Array.isArray(moodRows) ? moodRows : []
  const userSignal = scoreMoodSignalFromText(question)
  const recentSignal = rows
    .slice(-30)
    .reduce((sum, row) => sum + scoreMoodSignalFromText(row?.text), 0)
  const echoSignal = scoreMoodSignalFromText(recentEcho?.text)

  // Keep this intentionally small so memory context nudges mood without hijacking the model.
  const blendedSignal = userSignal * 0.45 + recentSignal * 0.03 + echoSignal * 0.35

  return {
    nudge: toSmallMoodNudge(blendedSignal),
    blendedSignal: roundMetric(blendedSignal, 3),
    userSignal: roundMetric(userSignal, 3),
    recentSignal: roundMetric(recentSignal, 3),
    echoSignal: roundMetric(echoSignal, 3),
    sampledRows: rows.length,
  }
}

async function fetchRecentChannelContext(channelId, question) {
  if (!CHAT_CONTEXT_ENABLED) {
    return {
      recentChat: [],
      moodRows: [],
      recentChatMeta: {
        source: 'disabled',
        sourceCount: 0,
        selectedCount: 0,
      },
    }
  }

  try {
    const chatBuffer = await getApiJson('memory/channel-buffer', {
      channelId,
      limit: ASK_CHAT_BUFFER_LIMIT,
    })
    const normalizedRows = normalizeChatRows(chatBuffer?.messages, 220)

    const { selected, meta } = buildSelectedChatContext(normalizedRows, question)
    return {
      recentChat: selected,
      moodRows: normalizedRows,
      recentChatMeta: {
        source: 'live',
        ...meta,
      },
    }
  } catch (err) {
    console.warn('chat context fetch failed:', err.message || err)
    return {
      recentChat: [],
      moodRows: [],
      recentChatMeta: {
        source: 'error',
        sourceCount: 0,
        selectedCount: 0,
      },
    }
  }
}

async function fetchMemoryEcho(channelId, userId) {
  try {
    const data = await getApiJson('memory/echo', {
      channelId,
      userId,
      windowDays: ASK_ECHO_WINDOW_DAYS,
    })

    return {
      recentEcho: data?.echo || null,
      recentEchoMeta: {
        found: Boolean(data?.found),
        source: 'live',
      },
    }
  } catch (err) {
    console.warn('memory echo fetch failed:', err.message || err)
    return {
      recentEcho: null,
      recentEchoMeta: {
        found: false,
        source: 'error',
      },
    }
  }
}

function summarizeMemoryProfile(memoryProfile) {
  if (!memoryProfile) {
    return {
      source: 'unavailable',
      userDelta30d: 'n/a',
      userFeeling30d: 'n/a',
      userAsks30d: 0,
      channelDelta7d: 'n/a',
      channelFeeling7d: 'n/a',
      channelAsks7d: 0,
      blendDelta: 'n/a',
      blendFeeling: 'n/a',
      themes: 'n/a',
    }
  }

  const topThemes = Array.isArray(memoryProfile.channelMood7d?.topThemes)
    ? memoryProfile.channelMood7d.topThemes.slice(0, 3).map((row) => row.theme).filter(Boolean)
    : []

  return {
    source: memoryProfile.cacheSource || 'live',
    userDelta30d: roundMetric(memoryProfile.avgDelta30d),
    userFeeling30d: roundMetric(memoryProfile.avgFeeling30d),
    userAsks30d: Number(memoryProfile.askCount30d || 0),
    channelDelta7d: roundMetric(memoryProfile.channelMood7d?.avgDelta),
    channelFeeling7d: roundMetric(memoryProfile.channelMood7d?.avgFeeling),
    channelAsks7d: Number(memoryProfile.channelMood7d?.askCount || 0),
    blendDelta: roundMetric(memoryProfile.blendedMood?.avgDelta),
    blendFeeling: roundMetric(memoryProfile.blendedMood?.avgFeeling),
    themes: topThemes.length ? topThemes.join(' | ') : 'n/a',
  }
}

function getCachedMemoryProfile(userId, channelId) {
  if (ASK_MEMORY_CACHE_TTL_MS <= 0) return null

  const cacheKey = getSummaryCacheKey(userId, channelId)
  const cached = summaryCache.get(cacheKey)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    summaryCache.delete(cacheKey)
    return null
  }

  return cached.value
}

function setCachedMemoryProfile(userId, channelId, memoryProfile) {
  if (ASK_MEMORY_CACHE_TTL_MS <= 0 || !memoryProfile) return

  const now = Date.now()
  const cacheKey = getSummaryCacheKey(userId, channelId)

  summaryCache.set(cacheKey, {
    value: memoryProfile,
    expiresAt: now + ASK_MEMORY_CACHE_TTL_MS,
  })

  if (summaryCache.size > 500) {
    for (const [key, entry] of summaryCache.entries()) {
      if (entry.expiresAt <= now) {
        summaryCache.delete(key)
      }
    }
  }
}

async function fetchUserMemoryProfile(userId, channelId) {
  const cachedProfile = getCachedMemoryProfile(userId, channelId)
  if (cachedProfile) {
    return {
      ...cachedProfile,
      cacheSource: 'cache',
    }
  }

  try {
    const [weekSummary, monthSummary, channelMood] = await Promise.all([
      getApiJson('memory/user-summary', {
        userId,
        channelId,
        windowDays: 7,
      }),
      getApiJson('memory/user-summary', {
        userId,
        channelId,
        windowDays: 30,
      }),
      getApiJson('memory/channel-mood', {
        channelId,
        windowDays: 7,
      }),
    ])

    const asks30 = Number(monthSummary?.glorp?.total_asks || 0)
    const safetyBlocks30 = Number(monthSummary?.glorp?.safety_blocks || 0)
    const insultRate30 = asks30 > 0 ? safetyBlocks30 / asks30 : 0

    const channelOverall = channelMood?.overall || {}
    const channelAvgDelta7d = Number(channelOverall.avg_delta || 0)
    const channelAvgFeeling7d = Number(channelOverall.avg_feeling || 5)
    const channelSafetyRate7d = Number(channelOverall.safety_block_rate || 0)
    const channelAskCount7d = Number(channelOverall.total_asks || 0)

    const weightedAvgDelta = avgWithWeights(
      Number(monthSummary?.glorp?.avg_delta || 0),
      channelAvgDelta7d,
    )
    const weightedAvgFeeling = avgWithWeights(
      Number(monthSummary?.glorp?.avg_feeling || 5),
      channelAvgFeeling7d,
    )
    const weightedInsultRate = avgWithWeights(insultRate30, channelSafetyRate7d)

    const memoryProfile = {
      avgDelta7d: Number(weekSummary?.glorp?.avg_delta || 0),
      avgDelta30d: Number(monthSummary?.glorp?.avg_delta || 0),
      avgFeeling30d: Number(monthSummary?.glorp?.avg_feeling || 5),
      askCount30d: asks30,
      safetyBlocks30d: safetyBlocks30,
      insultRate30d: insultRate30,
      glorpUses30d: getCommandCount(monthSummary, '!glorpbox'),
      slotsUses30d: getCommandCount(monthSummary, '!slots'),
      lootboxUses30d: getCommandCount(monthSummary, '!lootbox'),
      channelMood7d: {
        avgDelta: channelAvgDelta7d,
        avgFeeling: channelAvgFeeling7d,
        safetyRate: channelSafetyRate7d,
        askCount: channelAskCount7d,
        topThemes: Array.isArray(channelMood?.topThemes) ? channelMood.topThemes : [],
        sentimentTrend: Array.isArray(channelMood?.sentimentTrend)
          ? channelMood.sentimentTrend
          : [],
      },
      weights: {
        user: USER_MOOD_WEIGHT,
        channel: CHANNEL_MOOD_WEIGHT,
      },
      blendedMood: {
        avgDelta: weightedAvgDelta,
        avgFeeling: weightedAvgFeeling,
        insultRate: weightedInsultRate,
      },
      cacheSource: 'live',
    }

    setCachedMemoryProfile(userId, channelId, memoryProfile)
    return memoryProfile
  } catch (err) {
    console.warn('memory summary fetch failed:', err.message || err)
    return null
  }
}

function avgWithWeights(userValue, channelValue) {
  return userValue * USER_MOOD_WEIGHT + channelValue * CHANNEL_MOOD_WEIGHT
}

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const userId = getUserId(tags)
    const requestId = nextAskRequestId()

    try {
      const question = extraParams.map((p) => Object.values(p)[0]).join(' ')

      if (!question || question.length < 2) {
        client.say(channel, `@${tags.username}, ask me about the glorps...`)
        return
      }

      if (usersInFlight.has(userId)) {
        client.say(channel, `@${tags.username}, hold thy slime... I am still crafting thy last answer.`)
        return
      }

      if (globalInFlight >= ASK_MAX_CONCURRENT) {
        client.say(channel, `@${tags.username}, the slime engine is busy. Try again in a few seconds.`)
        return
      }

      if (!isAdminUser(String(tags.username || '').toLowerCase()) && isCoolingDown(userId)) {
        client.say(channel, `@${tags.username}, slow thy typing for a moment, mortal.`)
        return
      }

      usersInFlight.add(userId)
      userLastAskAt.set(userId, Date.now())
      globalInFlight += 1

      console.log(`[ask:${requestId}] start`, {
        user: tags.username,
        userId,
        channel: channel.startsWith('#') ? channel.slice(1) : channel,
        question,
        cacheTtlMs: ASK_MEMORY_CACHE_TTL_MS,
        globalInFlight,
        askMaxConcurrent: ASK_MAX_CONCURRENT,
      })

      const rawChannel = channel.startsWith('#') ? channel.slice(1) : channel
      const [memoryProfile, chatContext, echoContext] = await Promise.all([
        fetchUserMemoryProfile(userId, rawChannel),
        fetchRecentChannelContext(rawChannel, question),
        fetchMemoryEcho(rawChannel, userId),
      ])
      const promptMemoryProfile = {
        ...(memoryProfile || {}),
        recentChat: chatContext.recentChat,
        recentChatMeta: chatContext.recentChatMeta,
        recentEcho: echoContext.recentEcho,
        recentEchoMeta: echoContext.recentEchoMeta,
      }

      console.log(`[ask:${requestId}] mood`, summarizeMemoryProfile(memoryProfile))
      console.log(`[ask:${requestId}] chat`, chatContext.recentChatMeta)
      console.log(`[ask:${requestId}] echo`, echoContext.recentEchoMeta)
      if (LOG_VERBOSE_AI && memoryProfile) {
        console.log(`[ask:${requestId}] mood.verbose`, memoryProfile)
      }

      const { reply, delta, feeling, emotion, reason } = await askGPT(
        question,
        tags.username,
        promptMemoryProfile,
      )
      const contextNudge = computeContextMoodNudge(
        question,
        chatContext.moodRows,
        echoContext.recentEcho,
      )
      const adjustedDelta = clamp(Number(delta || 0) + contextNudge.nudge, -2, 2)
      let adjustedFeeling = clamp(Number(feeling || 5), 1, 10)
      if (contextNudge.nudge !== 0) {
        adjustedFeeling = updateFeeling(tags.username, contextNudge.nudge)
      }

      const moderation = moderateReply(reply)
      const finalReply = moderation.safeReply

      console.log(`[ask:${requestId}] result`, {
        providerMoodDelta: delta,
        providerFeeling: feeling,
        contextNudge: contextNudge.nudge,
        contextSignal: contextNudge.blendedSignal,
        adjustedMoodDelta: adjustedDelta,
        adjustedFeeling,
        emotion: emotion || 'n/a',
        safetyBlocked: moderation.blocked,
        safetyReason: moderation.reason || 'none',
        replyChars: String(finalReply || '').length,
      })

      postApi('memory/glorp', {
        username: tags.username,
        userId,
        channelId: rawChannel,
        question,
        reply: finalReply,
        delta: adjustedDelta,
        feeling: adjustedFeeling,
        emotion,
        reason,
        safetyBlocked: moderation.blocked,
        safetyReason: moderation.reason,
      }).catch((logErr) => {
        console.warn('memory/glorp log failed:', logErr.message || logErr)
      })

      client.say(channel, `@${tags.username}, ${finalReply}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`[ask:${requestId}] error`, code)
      client.say(channel, errorMessage)
    } finally {
      usersInFlight.delete(userId)
      globalInFlight = Math.max(0, globalInFlight - 1)
    }
  },
}
