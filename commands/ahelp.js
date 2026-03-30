const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

const ADMIN_HELP_BY_CATEGORY = {
  economy: 'Economy admin: !blackmarket refresh',
  jackpot: 'Jackpot admin: !jackpotinspect !jackpotseed <amount> !jackpottest [bet] !freespintest [bet]',
  ai: 'AI admin: !asksafetytest !glorppipelinetest !glorpprompttest <question> !glorpcoretest',
}

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, ahelp is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    const requestedCategory = extraParams?.[0]?.param0?.toLowerCase?.() || ''

    if (requestedCategory && ADMIN_HELP_BY_CATEGORY[requestedCategory]) {
      client.say(
        channel,
        `@${tags.username}, ${ADMIN_HELP_BY_CATEGORY[requestedCategory]} \u200B`,
      )
      return
    }

    if (requestedCategory && !ADMIN_HELP_BY_CATEGORY[requestedCategory]) {
      client.say(
        channel,
        `@${tags.username}, Unknown admin category "${requestedCategory}". Try: !ahelp economy | !ahelp jackpot | !ahelp ai \u200B`,
      )
      return
    }

    client.say(
      channel,
      `@${tags.username}, Admin quick help: !ahelp economy | !ahelp jackpot | !ahelp ai \u200B`,
    )
  },
}