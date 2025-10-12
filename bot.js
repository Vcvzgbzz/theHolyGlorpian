require('dotenv').config()
const tmi = require('tmi.js')
const { handleCommand } = require('./commands')

// === Bot Configuration ===
const opts = {
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN,
  },
  channels: [process.env.TWITCH_CHANNEL],
}

const client = new tmi.Client(opts)

// === Event Listeners ===
client.on('message', (channel, tags, message, self) => {
  if (self) return
  handleCommand(client, channel, tags, message)
})

client.on('connected', (addr, port) => {
  console.log(`🤖 Bot connected to ${addr}:${port}`)
})

client.connect()
