const { ADMIN_USERS } = require('../utils/admins')

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      client.say(
        channel,
        `@${tags.username}, Commands: !lootbox | !buylootbox <rarity> | !inventory | !sellAll <rarity> | !slots <amount> | !balance | !stats | !mood | !glorpbox <question> | !asksafetytest [admin] | !glorppipelinetest [admin] | !glorpprompttest <question> [admin] | !glorpcoretest [admin] — admins: ${ADMIN_USERS.join(', ')} \u200B`
      )
    } catch (err) {
      console.error('❌ Error in slots:', err.message)
      client.say(channel, `@${tags.username}, something went wrong.`)
    }
  },
}
