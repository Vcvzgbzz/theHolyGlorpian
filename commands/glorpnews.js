const { getApiJson } = require('../utils/api')

const MODE_MAP = {
  daily: { windowDays: 1, label: 'daily' },
  weekly: { windowDays: 7, label: 'weekly' },
  monthly: { windowDays: 30, label: 'monthly' },
}

function formatNumber(value, fallback = '0') {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return num.toLocaleString('en-US')
}

function getVibeLabel(avgDelta) {
  const delta = Number(avgDelta || 0)
  if (delta >= 0.9) return 'hyped'
  if (delta >= 0.35) return 'good'
  if (delta > -0.25) return 'steady'
  if (delta > -0.9) return 'tense'
  return 'cursed'
}

function parseMode(raw) {
  const mode = String(raw || 'daily').toLowerCase().trim()
  return MODE_MAP[mode] || MODE_MAP.daily
}

function formatThemes(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'n/a'
  return rows
    .slice(0, 3)
    .map((row) => row.theme)
    .filter(Boolean)
    .join(' | ') || 'n/a'
}

function formatArcStage(stage) {
  const raw = String(stage || 'setup').toLowerCase()
  if (raw === 'setup') return 'setup'
  if (raw === 'escalation') return 'rising'
  if (raw === 'climax') return 'climax'
  if (raw === 'resolution') return 'resolution'
  return raw
}

function formatEchoSnippet(echo) {
  if (!echo || !echo.text) return 'n/a'
  const text = String(echo.text).replace(/\s+/g, ' ').trim()
  if (text.length <= 70) return text
  return `${text.slice(0, 67)}...`
}

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const channelId = channel.startsWith('#') ? channel.slice(1) : channel
    const modeArg = extraParams[0]?.param0
    const mode = parseMode(modeArg)

    try {
      const [mood, arc, echoResp] = await Promise.all([
        getApiJson('memory/channel-mood', {
          channelId,
          windowDays: mode.windowDays,
        }),
        getApiJson('memory/story-arc', {
          channelId,
        }).catch(() => null),
        getApiJson('memory/echo', {
          channelId,
          windowDays: Math.min(mode.windowDays, 30),
        }).catch(() => null),
      ])

      const overall = mood?.overall || {}
      const asks = Number(overall.total_asks || 0)
      const avgDelta = Number(overall.avg_delta || 0)
      const avgFeeling = Number(overall.avg_feeling || 5)
      const safetyRate = Number(overall.safety_block_rate || 0)
      const themes = formatThemes(mood?.topThemes)

      if (asks <= 0) {
        client.say(
          channel,
          `@${tags.username}, 📰 Glorp News (${mode.label}): no asks logged yet. Themes: n/a. Vibe: unknown.\u200B`
        )
        return
      }

      const deltaText = avgDelta.toFixed(2)
      const feelingText = avgFeeling.toFixed(2)
      const safetyPct = `${(safetyRate * 100).toFixed(1)}%`
      const vibe = getVibeLabel(avgDelta)
      const arcStage = formatArcStage(arc?.stage)
      const arcProgress = Number(arc?.progressPoints || 0)
      const arcThreshold = Number(arc?.threshold || 0)
      const arcText = arcThreshold > 0 ? `${arcStage} ${arcProgress}/${arcThreshold}` : `${arcStage}`
      const echoText = formatEchoSnippet(echoResp?.echo)

      client.say(
        channel,
        `@${tags.username}, 📰 Glorp News (${mode.label}): vibe ${vibe} | asks ${formatNumber(asks)} | feeling ${feelingText}/10 | delta ${deltaText} | safety ${safetyPct} | arc ${arcText} | themes ${themes} | echo ${echoText}\u200B`
      )
    } catch (err) {
      console.error('❌ Error in glorpnews:', err.message || err)
      client.say(channel, `@${tags.username}, I cannot summon the slime news right now.`)
    }
  },
}
