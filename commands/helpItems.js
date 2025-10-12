module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      client.say(
        channel,
        `@${tags.username},
        The current Available commands include:\n !sellAll - which sells all your current items\n !inventory - which checks your inventory\n !lootbox - Open a lootbox\n !slots {amount} - run the slots with the amount specified ( be prepared to lose ) \u200B`
      )
    } catch (err) {
      console.error('❌ Error in slots:', err.message)
      client.say(channel, `@${tags.username}, something went wrong.`)
    }
  },
}
