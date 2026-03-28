const { getApiJson } = require('../utils/api')
const { isAdminUser, ADMIN_USERS } = require('../utils/admins')
const { inspectPrompt } = require('../utils/gpt')

const USER_MOOD_WEIGHT = 0.4
const CHANNEL_MOOD_WEIGHT = 0.6

function getCommandCount(summary, commandName) {
  if (!summary || !Array.isArray(summary.commands)) return 0

  const row = summary.commands.find((item) => item.command_name === commandName)
  if (!row) return 0

  const count = Number(row.command_count)
  return Number.isFinite(count) ? count : 0
}

function avgWithWeights(userValue, channelValue) {
  return userValue * USER_MOOD_WEIGHT + channelValue * CHANNEL_MOOD_WEIGHT
}

async function fetchPromptMemoryProfile(userId, channelId) {
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

  return {
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
      avgDelta: avgWithWeights(Number(monthSummary?.glorp?.avg_delta || 0), channelAvgDelta7d),
      avgFeeling: avgWithWeights(Number(monthSummary?.glorp?.avg_feeling || 5), channelAvgFeeling7d),
      insultRate: avgWithWeights(insultRate30, channelSafetyRate7d),
    },
  }
}

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const username = String(tags.username || '').toLowerCase()
    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, glorpprompttest is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    const promptText = extraParams.map((p) => Object.values(p)[0]).join(' ').trim()
    if (!promptText) {
      client.say(channel, `@${tags.username}, usage: !glorpprompttest <question>`)
      return
    }

    try {
      const userId = tags['user-id'] || tags.username
      const channelId = channel.startsWith('#') ? channel.slice(1) : channel
      const memoryProfile = await fetchPromptMemoryProfile(userId, channelId)
      const inspection = inspectPrompt(promptText, tags.username, memoryProfile)

      client.say(
        channel,
        `@${tags.username}, prompt test: ${inspection.promptVersion} | core: ${inspection.summary.coreIdentitySource} (${inspection.summary.coreIdentityChars} chars) | tone: ${inspection.summary.toneBand} | temp: ${inspection.summary.temperament ?? 'n/a'} | weights U${inspection.summary.userWeight}/C${inspection.summary.channelWeight} | themes: ${inspection.summary.themes}`,
      )
    } catch (err) {
      console.error('❌ Error in glorpprompttest:', err)
      client.say(channel, `@${tags.username}, glorpprompttest errored. Check logs.`)
    }
  },
}