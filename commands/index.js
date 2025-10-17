const sellAllCommand = require('./sellAll')
const lootboxCommand = require('./lootbox')
const inventoryCommand = require('./inventory')
const slotsCommand = require('./slots')
const helpCommand = require('./helpItems')
const askCommand = require('./ask')
const buylootbox = require('./rarityLootbox')
const checkBalance = require('./balance')

const commandMap = {
  '!sellall': sellAllCommand,
  '!lootbox': lootboxCommand,
  '!inventory': inventoryCommand,
  '!slots': slotsCommand,
  '!help': helpCommand,
  '!glorpbox': askCommand,
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
      if (tags.username === 'slumpymr') {
        client.say(channel, `My liege, I bid thy command\u200B`)
      }
      console.log(`[${command}] Request received from ${tags.username}`, {
        params: extraParams,
        message: message,
      })
      await handler.execute(client, channel, tags, extraParams)
    }
  } catch (err) {
    console.log(err)
  }
}

module.exports = { handleCommand }
