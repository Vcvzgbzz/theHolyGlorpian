const { isAdminUser, ADMIN_USERS } = require('../utils/admins')
const { inspectPrompt } = require('../utils/gpt')

module.exports = {
  execute: async (client, channel, tags) => {
    const username = String(tags.username || '').toLowerCase()
    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, glorpcoretest is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    try {
      const inspection = inspectPrompt('[core identity probe]', tags.username, null)
      client.say(
        channel,
        `@${tags.username}, core identity: ${inspection.summary.coreIdentitySource} | chars: ${inspection.summary.coreIdentityChars} | prompt: ${inspection.promptVersion} | verbose logs: ${String(process.env.LOG_VERBOSE_AI || '').toLowerCase() === 'true' ? 'on' : 'off'}`,
      )
    } catch (err) {
      console.error('❌ Error in glorpcoretest:', err)
      client.say(channel, `@${tags.username}, glorpcoretest errored. Check logs.`)
    }
  },
}