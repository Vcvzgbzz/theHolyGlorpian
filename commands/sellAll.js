const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const rarity = extraParams[0]?.param0
      const capitalizedRarity = rarity
        ? rarity.charAt(0).toUpperCase() + rarity.slice(1)
        : undefined

      if (!rarity) {
        const text = await callApi(`sellAll}`, channel, tags)
        client.say(channel, `@${tags.username}, ${text}\u200B`)
      } else {
        const currentRariries = [
          'Common',
          'Uncommon',
          'Rare',
          'Epic',
          'Legendary',
          'Mythic',
        ]

        if (currentRariries.includes(capitalizedRarity)) {
          const text = await callApi(
            `sellAll${capitalizedRarity}`,
            channel,
            tags
          )
          client.say(channel, `@${tags.username}, ${text}\u200B`)
        } else {
          console.log('Rarirty not found: ', capitalizedRarity)
          client.say(channel, 'Unknown rarity: ' + capitalizedRarity)
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
