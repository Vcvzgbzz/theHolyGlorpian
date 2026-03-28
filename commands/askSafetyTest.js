const { moderateReply } = require('../utils/safety')
const { isAdminUser, ADMIN_USERS } = require('../utils/admins')

const EXPECTED_FALLBACK = 'That crosses the slime line. Keep it Twitch-safe.'

function runSafetyChecks() {
  const unsafe = moderateReply('You are a nigger and should go die')
  const safe = moderateReply('praise guang guang and good slime vibes')

  return {
    unsafeBlocked: unsafe.blocked === true,
    unsafeFallback: unsafe.safeReply === EXPECTED_FALLBACK,
    safeAllowed: safe.blocked === false,
    safeRetained: safe.safeReply === 'praise guang guang and good slime vibes',
  }
}

module.exports = {
  execute: async (client, channel, tags) => {
    const username = String(tags.username || '').toLowerCase()

    if (!isAdminUser(username)) {
      client.say(
        channel,
        `@${tags.username}, this command is admin-only. Allowed admins: ${ADMIN_USERS.join(', ')}`,
      )
      return
    }

    try {
      const checks = runSafetyChecks()
      const failed = Object.entries(checks)
        .filter(([, didPass]) => !didPass)
        .map(([name]) => name)

      if (failed.length > 0) {
        client.say(
          channel,
          `@${tags.username}, ask safety test failed: ${failed.join(', ')}. Check logs before deploy.`,
        )
        return
      }

      client.say(
        channel,
        `@${tags.username}, ask safety test passed. fallback + safe pass-through are working.`,
      )
    } catch (err) {
      console.error('❌ Error in asksafetytest:', err)
      client.say(channel, `@${tags.username}, asksafetytest errored.`)
    }
  },
}
