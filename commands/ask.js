const { askGPT } = require('../utils/gpt')
const { getErrorMessage } = require('../utils/errors')
const { postApi, getApiJson } = require('../utils/api')
const { moderateReply } = require('../utils/safety')

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
const summaryCache = new Map()
let globalInFlight = 0
let askRequestCounter = 0

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

      if (isCoolingDown(userId)) {
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
      const memoryProfile = await fetchUserMemoryProfile(userId, rawChannel)
      console.log(`[ask:${requestId}] mood`, summarizeMemoryProfile(memoryProfile))
      if (LOG_VERBOSE_AI && memoryProfile) {
        console.log(`[ask:${requestId}] mood.verbose`, memoryProfile)
      }

      const { reply, delta, feeling, emotion, reason } = await askGPT(
        question,
        tags.username,
        memoryProfile,
      )
      const moderation = moderateReply(reply)
      const finalReply = moderation.safeReply

      console.log(`[ask:${requestId}] result`, {
        providerMoodDelta: delta,
        feeling,
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
        delta,
        feeling,
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
