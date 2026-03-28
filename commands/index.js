const sellAllCommand = require('./sellAll')
const lootboxCommand = require('./lootbox')
const inventoryCommand = require('./inventory')
const slotsCommand = require('./slots')
const helpCommand = require('./helpItems')
const askCommand = require('./ask')
const askSafetyTestCommand = require('./askSafetyTest')
const glorpPipelineTestCommand = require('./glorpPipelineTest')
const glorpPromptTestCommand = require('./glorpPromptTest')
const glorpCoreIdentityTestCommand = require('./glorpCoreIdentityTest')
const statsCommand = require('./stats')
const moodCommand = require('./mood')
const buylootbox = require('./rarityLootbox')
const checkBalance = require('./balance')
const { postApi } = require('../utils/api')

const commandMap = {
  '!sellall': sellAllCommand,
  '!lootbox': lootboxCommand,
  '!inventory': inventoryCommand,
  '!slots': slotsCommand,
  '!help': helpCommand,
  '!stats': statsCommand,
  '!mood': moodCommand,
  '!glorpbox': askCommand,
  '!asksafetytest': askSafetyTestCommand,
  '!glorppipelinetest': glorpPipelineTestCommand,
  '!glorpprompttest': glorpPromptTestCommand,
  '!glorpcoretest': glorpCoreIdentityTestCommand,
  '!buylootbox': buylootbox,
  '!balance': checkBalance,
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
      }
    }
  } catch (err) {
    console.log(err)
  }
}

module.exports = { handleCommand }
