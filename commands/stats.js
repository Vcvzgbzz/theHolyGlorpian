const { getApiJson } = require('../utils/api')
const { getRelationshipDetails } = require('../utils/relationship')

function getCommandCount(summary, commandName) {
  if (!summary || !Array.isArray(summary.commands)) return 0

  const row = summary.commands.find((item) => item.command_name === commandName)
  if (!row) return 0

  const count = Number(row.command_count)
  return Number.isFinite(count) ? count : 0
}

module.exports = {
  execute: async (client, channel, tags) => {
    const userId = tags['user-id'] || tags.username
    const channelId = channel.startsWith('#') ? channel.slice(1) : channel

    try {
      const summary = await getApiJson('memory/user-summary', {
        userId,
        channelId,
        windowDays: 'all',
      })

      const lootboxPulls = getCommandCount(summary, '!lootbox')
      const slotsUses = getCommandCount(summary, '!slots')
      const lootboxPurchases = getCommandCount(summary, '!buylootbox')
      const relationship = getRelationshipDetails(summary)

      client.say(
        channel,
        `@${tags.username}, your Glorp stats: lootbox pulls ${lootboxPulls} | slots uses ${slotsUses} | lootbox purchases ${lootboxPurchases} | ${relationship.text}\u200B`
      )
    } catch (err) {
      console.error('❌ Error in stats:', err.message || err)
      client.say(channel, `@${tags.username}, I could not read thy stats right now.`)
    }
  },
}