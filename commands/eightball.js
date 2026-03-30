const CLASSIC_8BALL_RESPONSES = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes - definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
]

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    const question = extraParams.map((entry) => Object.values(entry)[0]).join(' ').trim()

    if (!question || question.length < 3) {
      client.say(channel, `@${tags.username}, ask a full question. Usage: !8ball <question>`)
      return
    }

    const roll = Math.floor(Math.random() * CLASSIC_8BALL_RESPONSES.length)
    const answer = CLASSIC_8BALL_RESPONSES[roll]

    client.say(channel, `@${tags.username}, 🎱 ${answer}\u200B`)
  },
}
