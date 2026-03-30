const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0]).filter(Boolean)
      const requestParams = []

      if (params.length > 0) {
        requestParams.push({ rarities: params.join(',') })
      }

      const text = await callApi('combine', channel, tags, requestParams)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in combine:', code)
      client.say(channel, errorMessage)
    }
  },
}
