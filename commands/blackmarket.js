const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')
const { isAdminUser } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const first = String(extraParams[0]?.param0 || '').toLowerCase()
      const second = extraParams[1]?.param1
      const requestParams = []

      if (first === 'refresh') {
        if (!isAdminUser(tags.username)) {
          client.say(channel, `@${tags.username}, blackmarket refresh is admin-only.`)
          return
        }

        requestParams.push({ action: 'refresh' })
      } else if (first === 'buy') {
        const slot = Number(second)
        if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
          client.say(channel, `@${tags.username}, usage: !blackmarket buy <1-3>`)
          return
        }

        requestParams.push({ action: 'buy' })
        requestParams.push({ slot })
      }

      const text = await callApi('blackmarket', channel, tags, requestParams)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in blackmarket:', code)
      client.say(channel, errorMessage)
    }
  },
}