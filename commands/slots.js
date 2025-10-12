const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const balance = extraParams[0]?.param0

      const text = await callApi('slots', channel, tags, [{ balance }])

      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`❌ Error in slots:`, code)
      client.say(channel, errorMessage)
    }
  },
}
