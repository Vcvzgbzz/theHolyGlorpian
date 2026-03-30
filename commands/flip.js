const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0])
      const amount = params[0]

      if (!amount) {
        client.say(channel, `@${tags.username}, usage: !flip <amount>`)
        return
      }

      const parsedAmount = Number(amount)
      if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
        client.say(channel, `@${tags.username}, flip amount must be a positive whole number.`)
        return
      }

      const text = await callApi('flip', channel, tags, [{ amount: parsedAmount }])
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in flip:', code)
      client.say(channel, errorMessage)
    }
  },
}
