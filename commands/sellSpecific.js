const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const quantity = extraParams[0]?.param0
      const condition = extraParams[1]?.param1
      const itemName = extraParams[2]?.param2

      const text = await callApi(`sell`, channel, tags)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`❌ Error in sellRarity:`, code)
      client.say(channel, errorMessage)
    }
  },
}
