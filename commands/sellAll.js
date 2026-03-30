const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const rarity = extraParams[0]?.param0
      const normalizedRarity = rarity
        ? rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()
        : undefined

      if (!normalizedRarity) {
        const text = await callApi('sellAll', channel, tags)
        client.say(channel, `@${tags.username}, ${text}\u200B`)
      } else {
        const currentRarities = [
          'Common',
          'Uncommon',
          'Rare',
          'Epic',
          'Legendary',
          'Mythic',
        ]

        if (currentRarities.includes(normalizedRarity)) {
          const text = await callApi(
            `sellAll${normalizedRarity}`,
            channel,
            tags
          )
          client.say(channel, `@${tags.username}, ${text}\u200B`)
        } else {
          console.log('Rarity not found: ', normalizedRarity)
          client.say(channel, `@${tags.username}, unknown rarity: ${normalizedRarity}`)
        }
      }
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`❌ Error in sellRarity:`, code)
      client.say(channel, errorMessage)
    }
  },
}
