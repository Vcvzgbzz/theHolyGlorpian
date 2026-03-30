const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const params = extraParams.map((entry) => Object.values(entry)[0])
      const first = String(params[0] || '').toLowerCase()
      const second = params[1]

      const requestParams = []

      if (first === 'start') {
        if (!second) {
          client.say(channel, `@${tags.username}, usage: !heist start <amount>`)
          return
        }

        const parsedAmount = Number(second)
        if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
          client.say(channel, `@${tags.username}, heist amount must be a positive whole number.`)
          return
        }

        requestParams.push({ action: 'start' })
        requestParams.push({ amount: parsedAmount })
      } else if (first === 'join' || first === 'resolve') {
        requestParams.push({ action: first })
      } else if (first) {
        const parsedAmount = Number(first)
        if (Number.isInteger(parsedAmount) && parsedAmount > 0) {
          requestParams.push({ action: 'start' })
          requestParams.push({ amount: parsedAmount })
        } else {
          requestParams.push({ action: first })
        }
      }

      const text = await callApi('heist', channel, tags, requestParams)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in heist:', code)
      client.say(channel, errorMessage)
    }
  },
}
