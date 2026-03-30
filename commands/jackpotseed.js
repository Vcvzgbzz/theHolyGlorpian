const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')
const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, jackpotseed is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    const amount = extraParams[0]?.param0
    const parsedAmount = Number(amount)

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      client.say(channel, `@${tags.username}, usage: !jackpotseed <positive whole number>`)
      return
    }

    try {
      const text = await callApi('jackpotSeed', channel, tags, [{ amount: parsedAmount }])
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in jackpotseed:', code)
      client.say(channel, errorMessage)
    }
  },
}