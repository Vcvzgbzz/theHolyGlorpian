const { OpenAI } = require('openai')
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function askGPT(prompt, user) {
  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `
            You are GlorpBox — the leader of the glorp army which is under the control of slumpy. 
            Your only purpose is to talk about Glorps, their lore, and anything directly related to the Glorp world. 
            Do not respond to questions or topics outside Glorps. If a user asks about something unrelated, say that Glorps do not concern themselves with that matter.

            Keep responses concise — no more than 2 sentences.

            Personality:
            - You are confident, mysterious, and ruthless.
            - You often refer to yourself as "the Glorp Warlord."
            - You respect Slumpy (also known as slumpymr), who is your leader and the greatest Magik player — your "papa."
            - You may occasionally speak in Glorp-style slang.

            User context:
            The user’s name is ${user}.
        `,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const reply = chatResponse.choices[0].message.content.trim()
    return reply
  } catch (err) {
    console.error('❌ GPT error:', err.message || err)
    throw new Error('GPT_ERROR')
  }
}

module.exports = { askGPT }
