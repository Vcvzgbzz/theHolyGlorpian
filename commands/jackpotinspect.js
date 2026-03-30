const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')
const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, jackpotinspect is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    try {
      const text = await callApi('jackpot', channel, tags)
      client.say(channel, `@${tags.username}, ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in jackpotinspect:', code)
      client.say(channel, errorMessage)
    }
  },
}