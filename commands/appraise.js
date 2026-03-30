const { askGPT } = require('../utils/gpt')
const { getApiJson } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')
const { moderateReply } = require('../utils/safety')

function formatRarityBreakdown(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'none'
  return rows
    .map((row) => `${row.rarity}: ${row.itemCount} items / value ${row.totalValue}`)
    .join(' | ')
}

function formatTopItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'none'
  return rows
    .map((row) => `${row.rarity} ${row.name} (${row.condition}) value ${row.value}`)
    .join(' | ')
}

module.exports = {
  execute: async (client, channel, tags) => {
    const userId = tags['user-id'] || tags.username
    const channelId = channel.startsWith('#') ? channel.slice(1) : channel

    try {
      const summary = await getApiJson('appraiseSummary', {
        username: tags.username,
        userId,
        channelId,
      })

      const appraisalPrompt = [
        `Appraise ${tags.username}'s lootbox inventory in Glorp voice.`,
        'Keep response to 2 short sentences and include one actionable recommendation.',
        `Balance: ${Number(summary?.balance || 0)}`,
        `Total items: ${Number(summary?.totalItems || 0)}`,
        `Total inventory value: ${Number(summary?.totalInventoryValue || 0)}`,
        `Rarity breakdown: ${formatRarityBreakdown(summary?.rarityBreakdown)}`,
        `Top items: ${formatTopItems(summary?.topItems)}`,
      ].join('\n')

      const { reply } = await askGPT(appraisalPrompt, tags.username, null)
      const moderated = moderateReply(reply)
      const safeReply = moderated.safeReply || 'The slime cannot appraise this stash right now.'

      client.say(channel, `@${tags.username}, ${safeReply}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in appraise:', code)
      client.say(channel, errorMessage)
    }
  },
}
