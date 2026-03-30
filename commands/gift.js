const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0])
      const recipient = params[0]
      const amount = params[1]

      if (!recipient || !amount) {
        client.say(channel, `@${tags.username}, usage: !gift @user <amount>`)
        return
      }

      const parsedAmount = Number(amount)
      if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
        client.say(channel, `@${tags.username}, gift amount must be a positive whole number.`)
        return
      }

      const text = await callApi('gift', channel, tags, [{ recipient }, { amount: parsedAmount }])
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in gift:', code)
      client.say(channel, errorMessage)
    }
  },
}
