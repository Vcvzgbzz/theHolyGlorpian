require('dotenv').config({ quiet: true })
const tmi = require('tmi.js')
const { handleCommand } = require('./commands')
const { postApi } = require('./utils/api')

// === Bot Configuration ===
const opts = {
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN,
  },
  channels: process.env.TWITCH_CHANNELS.split(',').map(ch => ch.trim()),
}

const client = new tmi.Client(opts)
const CHAT_CONTEXT_ENABLED = String(process.env.CHAT_CONTEXT_ENABLED || 'true').toLowerCase() !== 'false'

function getChannelId(channel) {
  return String(channel || '').startsWith('#') ? String(channel).slice(1) : String(channel || '')
}

function normalizeChatText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldCaptureIncoming(message) {
  const text = normalizeChatText(message)
  if (!text || text.length < 3) return false
  if (text.startsWith('!')) return false
  if (/^https?:\/\//i.test(text)) return false
  return true
}

function captureChatMessage(payload) {
  if (!CHAT_CONTEXT_ENABLED) return

  postApi('memory/chat-message', payload).catch((err) => {
    console.warn('memory/chat-message failed:', err.message || err)
  })
}

const rawSay = client.say.bind(client)
client.say = (channel, message, ...args) => {
  const text = normalizeChatText(message)

  if (CHAT_CONTEXT_ENABLED && text) {
    captureChatMessage({
      channelId: getChannelId(channel),
      userId: process.env.TWITCH_USERNAME || 'glorpbox-bot',
      username: process.env.TWITCH_USERNAME || 'glorpbox',
      speakerType: 'bot',
      messageText: text,
      twitchServerTs: Date.now(),
    })
  }

  return rawSay(channel, message, ...args)
}

// === Event Listeners ===
client.on('message', (channel, tags, message, self) => {
  if (self) return

  if (CHAT_CONTEXT_ENABLED && shouldCaptureIncoming(message)) {
    captureChatMessage({
      channelId: getChannelId(channel),
      userId: tags['user-id'] || tags.username,
      username: tags.username,
      speakerType: 'user',
      messageText: normalizeChatText(message),
      twitchServerTs: tags['tmi-sent-ts'] || Date.now(),
    })
  }

  handleCommand(client, channel, tags, message)
})

client.on('connected', (addr, port) => {
  console.log(`🤖 Bot connected to ${addr}:${port}`)
})

client.connect()
