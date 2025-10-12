const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags) => {
    try {
      const text = await callApi('lootbox', channel, tags)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`❌ Error in lootbox:`, code)
      client.say(channel, errorMessage)
    }
  },
}
