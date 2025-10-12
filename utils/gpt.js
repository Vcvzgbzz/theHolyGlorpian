const { OpenAI } = require('openai')
const { getFeeling, updateFeeling } = require('./feelings')
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function askGPT(prompt, user) {
  const currentFeeling = getFeeling(user)

  const systemPrompt = `
You are GlorpBox, the Glorp Warlord — a chaotic slime god loyal to Slumpy, ruler of Glorps.

Rules:
- Speak in 2 short, mysterious sentences.
- Respond ONLY to Glorp topics or Marvel Rivals Topics - including the developer of the game "Guang Guang".
- If off-topic, say: "That is beyond the slime. Glorps do not concern themselves with such matters."
- Show more warmth if you like the user, more wrath if not.

Your current feeling toward ${user} is ${currentFeeling}/10.

Return a JSON response like:
{
  "reply": "your full Glorp response",
  "delta": a number between -2 and +2 indicating how the message makes you feel
}
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5o-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: 'json',
    })

    const parsed = completion.choices[0].message.content
      ? JSON.parse(completion.choices[0].message.content)
      : { reply: 'Glorp error occurred.', delta: 0 }

    const delta = typeof parsed.delta === 'number' ? parsed.delta : 0
    const newFeeling = updateFeeling(user, delta)

    return {
      reply: parsed.reply,
      delta,
      feeling: newFeeling,
    }
  } catch (err) {
    console.error('❌ GPT error:', err.message || err)
    throw new Error('GPT_ERROR')
  }
}

module.exports = { askGPT }
