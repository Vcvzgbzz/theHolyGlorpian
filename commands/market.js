const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const rarityType = extraParams[0]?.param0
      const requestParams = []

      if (rarityType) {
        requestParams.push({ rarityType })
      }

      const text = await callApi('market', channel, tags, requestParams)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in market:', code)
      client.say(channel, errorMessage)
    }
  },
}