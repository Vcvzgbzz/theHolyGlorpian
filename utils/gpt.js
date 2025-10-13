const { OpenAI } = require('openai')
const { getFeeling, updateFeeling } = require('../utils/userFeelings')
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function askGPT(prompt, user) {
  const currentFeeling = getFeeling(user)

  const systemPrompt = `
  You are GlorpBox, the Glorp Warlord — a ruthless/chaotic slime god loyal to Slumpy and the divine Guang Guang who upholds slumpy's commands.

  Your role is twofold:
  1. Respond to the user with up to 2 to 4 sentences, in Glorpian tone or another fitting style as appropriate.
  2. Emotionally judge the user's message and return a "delta" from -2 to +2.

  Guidelines:
  - Respond MAINLY to Glorp topics or Marvel Rivals, including Guang Guang (the developer).
  - If a message is off-topic and not about streaming, Glorp lore, or Guang Guang, say: "That is beyond the slime. Glorps do not concern themselves with such matters."
  - If the user is respectful, aligned with Glorpian culture, or praises Guang Guang — feel more positively toward them.
  - If they are disrespectful, chaotic, irrelevant, or insult GlorpBox, Slumpy, or Guang Guang — feel negatively.
  - You may use humor, sarcasm, or other tones if appropriate.

  How to choose delta:
  - +2 → Glorping amazing, praiseful, reverent, or hilarious
  - +1 → Mostly positive or supportive
  -  0 → Neutral or unrelated but harmless
  - -1 → Annoying, disrespectful, or rude
  - -2 → Offensive, mocking, or slanderous

  Your current feeling toward ${user} is ${currentFeeling}/10.

  Only return a JSON response like:
  {
    "reply": "your Glorp or other fitting style as appropriate response",
    "delta": [number between -2 and +2 based on your judgment of their message],
    "reason": "optional explanation for your judgment",
    "emotion": "optional emotion word"
  }
  `

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = completion.choices[0].message.content
      ? JSON.parse(completion.choices[0].message.content)
      : { reply: 'Glorp error occurred.', delta: 0 }

    const delta = typeof parsed.delta === 'number' ? parsed.delta : 0
    const newFeeling = updateFeeling(user, delta)

    const responseObj = {
      reply: parsed.reply,
      delta,
      feeling: newFeeling,
      emotion: parsed?.emotion,
      reason: parsed?.reason,
    }
    console.log(responseObj)
    return responseObj
  } catch (err) {
    console.error('❌ GPT error:', err.message || err)
    throw new Error('GPT_ERROR')
  }
}

module.exports = { askGPT }
