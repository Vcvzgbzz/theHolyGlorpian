const sellAllCommand = require('./sellAll')
const lootboxCommand = require('./lootbox')
const inventoryCommand = require('./inventory')
const slotsCommand = require('./slots')
const helpCommand = require('./helpItems')
const askCommand = require('./ask')
const ahelpCommand = require('./ahelp')
const askSafetyTestCommand = require('./askSafetyTest')
const glorpPipelineTestCommand = require('./glorpPipelineTest')
const glorpPromptTestCommand = require('./glorpPromptTest')
const glorpCoreIdentityTestCommand = require('./glorpCoreIdentityTest')
const jackpotInspectCommand = require('./jackpotinspect')
const jackpotSeedCommand = require('./jackpotseed')
const freeSpinTestCommand = require('./freespintest')
const jackpotTestCommand = require('./jackpottest')
const statsCommand = require('./stats')
const moodCommand = require('./mood')
const buylootbox = require('./rarityLootbox')
const checkBalance = require('./balance')
const giftCommand = require('./gift')
const dailyCommand = require('./daily')
const leaderboardCommand = require('./leaderboard')
const flipCommand = require('./flip')
const rollCommand = require('./roll')
const appraiseCommand = require('./appraise')
const eightballCommand = require('./eightball')
const combineCommand = require('./combine')
const glorpNewsCommand = require('./glorpnews')
const questCommand = require('./quest')
const heistCommand = require('./heist')
const profileCommand = require('./profile')
const marketCommand = require('./market')
const blackMarketCommand = require('./blackmarket')
const { postApi } = require('../utils/api')

const STORY_ARC_POINTS_BY_COMMAND = {
  '!lootbox': 2,
  '!buylootbox': 3,
  '!slots': 2,
  '!flip': 1,
  '!roll': 2,
  '!daily': 1,
  '!gift': 1,
  '!combine': 2,
  '!appraise': 1,
  '!quest': 2,
  '!heist': 3,
  '!market': 1,
  '!blackmarket': 2,
}

const commandMap = {
  '!sellall': sellAllCommand,
  '!lootbox': lootboxCommand,
  '!inventory': inventoryCommand,
  '!slots': slotsCommand,
  '!help': helpCommand,
  '!ahelp': ahelpCommand,
  '!stats': statsCommand,
  '!mood': moodCommand,
  '!glorpbox': askCommand,
  '!jackpotinspect': jackpotInspectCommand,
  '!jackpotseed': jackpotSeedCommand,
  '!freespintest': freeSpinTestCommand,
  '!jackpottest': jackpotTestCommand,
  '!asksafetytest': askSafetyTestCommand,
  '!glorppipelinetest': glorpPipelineTestCommand,
  '!glorpprompttest': glorpPromptTestCommand,
  '!glorpcoretest': glorpCoreIdentityTestCommand,
  '!buylootbox': buylootbox,
  '!balance': checkBalance,
  '!gift': giftCommand,
  '!daily': dailyCommand,
  '!leaderboard': leaderboardCommand,
  '!flip': flipCommand,
  '!roll': rollCommand,
  '!appraise': appraiseCommand,
  '!8ball': eightballCommand,
  '!combine': combineCommand,
  '!glorpnews': glorpNewsCommand,
  '!quest': questCommand,
  '!heist': heistCommand,
  '!profile': profileCommand,
  '!market': marketCommand,
  '!blackmarket': blackMarketCommand,
}

function sanitizeCommand(input) {
  return input
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u034F\u061C\u180E\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

async function handleCommand(client, channel, tags, message) {
  try {
    const splitMessage = sanitizeCommand(message).split(' ')
    const command = splitMessage[0]

    const extraParams = splitMessage.slice(1).map((value, index) => ({
      [`param${index}`]: value,
    }))

    const handler = commandMap[command]
    if (handler) {
      let didSucceed = true
      let errorCode = null

      if (tags.username === 'slumpymr') {
        client.say(channel, `My liege, I bid thy command\u200B`)
      }
      console.log(`[${command}] request`, {
        user: tags.username,
        channel: channel.startsWith('#') ? channel.slice(1) : channel,
        paramCount: extraParams.length,
        messageChars: String(message || '').length,
        preview: String(message || '').slice(0, 80),
      })

      try {
        await handler.execute(client, channel, tags, extraParams)
      } catch (handlerErr) {
        didSucceed = false
        errorCode = handlerErr?.message || 'UNKNOWN_HANDLER_ERROR'
        throw handlerErr
      } finally {
        const channelId = channel.startsWith('#') ? channel.slice(1) : channel
        postApi('memory/event', {
          username: tags.username,
          userId: tags['user-id'] || tags.username,
          channelId,
          commandName: command,
          success: didSucceed,
          metadata: {
            errorCode,
            paramCount: extraParams.length,
          },
        }).catch((logErr) => {
          console.warn('memory/event log failed:', logErr.message || logErr)
        })

        const points = STORY_ARC_POINTS_BY_COMMAND[command]
        if (didSucceed && points) {
          postApi('memory/story-arc/progress', {
            channelId,
            eventType: command,
            points,
          }).catch((logErr) => {
            console.warn('memory/story-arc/progress failed:', logErr.message || logErr)
          })
        }
      }
    }
  } catch (err) {
    console.log(err)
  }
}

module.exports = { handleCommand }
