const { getApiJson } = require('../utils/api')
const { getRelationshipDetails } = require('../utils/relationship')

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

      const relationship = getRelationshipDetails(summary)
      const { totalAsks, avgDelta, avgFeeling, safetyBlocks } = relationship.metrics

      client.say(
        channel,
        `@${tags.username}, mood: ${relationship.text} | asks: ${totalAsks} | avg delta: ${avgDelta.toFixed(2)} | avg feeling: ${avgFeeling.toFixed(2)} | safety blocks: ${safetyBlocks} | how to improve: ${relationship.guide}\u200B`
      )
    } catch (err) {
      console.error('❌ Error in mood:', err.message || err)
      client.say(channel, `@${tags.username}, I could not read thy slime mood right now.`)
    }
  },
}