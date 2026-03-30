const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, ahelp is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    client.say(
      channel,
      `@${tags.username}, Admin commands: !ahelp | !jackpotinspect | !jackpotseed <amount> | !freespintest [bet] | !jackpottest [bet] | !asksafetytest | !glorppipelinetest | !glorpprompttest <question> | !glorpcoretest \u200B`,
    )
  },
}