const { callApi } = require('../utils/api')
const { getErrorMessage } = require('../utils/errors')
const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, jackpottest is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    const params = extraParams.map((entry) => Object.values(entry)[0])
    const balance = params[0] || '1'

    try {
      const text = await callApi('slots', channel, tags, [
        { balance },
        { forceSpins: JSON.stringify([['𝟕', '𝟕', '𝟕']]) },
        { forceBonusSpins: JSON.stringify([['𝟕', '𝟕', '𝟕']]) },
      ])
      client.say(channel, `@${tags.username}, [JACKPOT TEST] ${text}\u200B`)
    } catch (err) {
      const code = err.message || 'UNKNOWN'
      const errorMessage = getErrorMessage(code, tags.username)
      console.error('❌ Error in jackpottest:', code)
      client.say(channel, errorMessage)
    }
  },
}
