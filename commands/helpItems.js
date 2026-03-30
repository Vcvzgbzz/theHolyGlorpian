const HELP_BY_CATEGORY = {
  economy:
    'Economy: !balance !daily !gift @user <amount> !leaderboard [3-10]',
  items:
    'Items: !lootbox !buylootbox <rarity> !market [rarity] !blackmarket [buy <1-3>] !inventory !sellall [rarity] !combine [rarity ...] !appraise',
  games:
    'Games: !slots <amount> [x1-x10] !flip <amount> !roll <amount> !heist [join|start <amount>] !quest [claim]',
  fun:
    'Fun: !8ball <question> !mood !glorpnews [daily|weekly|monthly] !glorpbox <question>',
  utility: 'Utility: !profile !stats',
}

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const requestedCategory =
        extraParams?.[0]?.param0?.toLowerCase?.() || ''

      if (requestedCategory && HELP_BY_CATEGORY[requestedCategory]) {
        client.say(
          channel,
          `@${tags.username}, ${HELP_BY_CATEGORY[requestedCategory]} | admin: !ahelp \u200B`
        )
        return
      }

      if (requestedCategory && !HELP_BY_CATEGORY[requestedCategory]) {
        client.say(
          channel,
          `@${tags.username}, Unknown category "${requestedCategory}". Try: !help economy | !help items | !help games | !help fun | !help utility \u200B`
        )
        return
      }

      client.say(
        channel,
        `@${tags.username}, Quick help: !help economy | !help items | !help games | !help fun | !help utility | admin: !ahelp \u200B`
      )
    } catch (err) {
      console.error('❌ Error in help:', err.message)
      client.say(channel, `@${tags.username}, something went wrong.`)
    }
  },
}
