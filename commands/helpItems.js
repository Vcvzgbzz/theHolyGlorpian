module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      client.say(
        channel,
        `@${tags.username}, Commands: !lootbox | !buylootbox <rarity> | !inventory | !sellall [rarity] (default keeps legendary/mythic) | !combine [rarity ...] (default all except mythic) | !slots <amount> [x1-x10] | !balance | !gift @user <amount> | !daily | !leaderboard [3-10] | !flip <amount> | !roll <amount> | !appraise | !8ball <question> | !glorpnews [daily|weekly|monthly] | !stats | !mood | !glorpbox <question> | admins: !ahelp \u200B`
      )
    } catch (err) {
      console.error('❌ Error in slots:', err.message)
      client.say(channel, `@${tags.username}, something went wrong.`)
    }
  },
}
