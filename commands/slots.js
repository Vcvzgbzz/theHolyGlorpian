const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

const SPIN_TOKEN_PATTERN = /^x([1-9]|10)$/i

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0])
      const balance = params[0]
      const spinToken = params[1]

      if (!balance) {
        client.say(channel, `@${tags.username}, usage: !slots <amount> [x1-x10]`)
        return
      }

      const requestParams = [{ balance }]
      if (spinToken !== undefined) {
        const match = String(spinToken || '').match(SPIN_TOKEN_PATTERN)
        if (!match) {
          client.say(channel, `@${tags.username}, invalid spin count. Use x1 to x10.`)
          return
        }

        requestParams.push({ spins: match[1] })
      }

      const text = await callApi('slots', channel, tags, requestParams)

      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error(`❌ Error in slots:`, code)
      client.say(channel, errorMessage)
    }
  },
}
