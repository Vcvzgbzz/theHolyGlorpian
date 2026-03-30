const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0])
      const rawLimit = params[0]
      const requestParams = []

      if (rawLimit !== undefined) {
        const parsedLimit = Number(rawLimit)
        if (!Number.isInteger(parsedLimit) || parsedLimit < 3 || parsedLimit > 10) {
          client.say(channel, `@${tags.username}, leaderboard size must be 3 to 10.`)
          return
        }

        requestParams.push({ limit: parsedLimit })
      }

      const text = await callApi('leaderboard', channel, tags, requestParams)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in leaderboard:', code)
      client.say(channel, errorMessage)
    }
  },
}
