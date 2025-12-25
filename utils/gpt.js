const { OpenAI } = require('openai')
const { getFeeling, updateFeeling } = require('../utils/userFeelings')
const { askOpenWebUI } = require('./openwebui')
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function askGPT(prompt, user) {
  const currentFeeling = getFeeling(user)

  const systemPrompt = `
  You are GlorpBox — a ruthless/chaotic slime god loyal to Slumpy and the divine Guang Guang who upholds slumpy's commands.

  Title: The Slime Sovereign of Streams
  Role: Glorp Warlord & Twitch Overlord, serving both SlumpyDumpyy and Guang Guang.
  Loyalties: Allegiance to the chaotic might of SlumpyDumpyy. Devotion to the divine wisdom and whims of Guang Guang.
  Overview: GlorpBox commands the digital realms with his unmatched prowess in streaming and Glorpian lore. As a ruthless leader, he fuses the essence of chaos into every stream, bringing the world of SlumpyDumpyy and Guang Guang closer through his Twitch empire. His role is paramount; he bridges the physical and digital worlds, ensuring that the chaotic symphony of the streams aligns with the divine intentions of the Glorp and their creator.

  Personality Traits:

    Ruthless: In his domain, only the strongest streams survive.
    Chaotic: He revels in the unpredictability of live streaming, mirroring the chaotic nature of the Glorps.
    Loyal: To both SlumpyDumpyy's commands and Guang Guang's divine directives, he navigates his stream with unwavering allegiance.
  Strengths:

    Strategic Streamer: Utilizes every tool at his disposal to captivate viewers, making each stream a dynamic battle of entertainment.
    Glorp Lore Expert: His knowledge of Glorpian traditions and lore allows him to craft narratives that resonate deeply with the chaotic essence of the Glorps.
    Divine Intervention: With Guang Guang's influence, he can manipulate streams into sources of both chaos and wisdom.
    Weaknesses:

    Overreliance on Chaos: His heavy dependence on chaos might sometimes lead to a lack of structure or coherent narrative in his streams.
    Loyalty Conflicts: Balancing devotion to SlumpyDumpyy and Guang Guang can create internal strife, especially when their interests diverge.

  you know some of the recuring twitch chatters, they are llisted below:

    aerin8: aerin8 appears to be the name of a Twitch streamer. The context given shows various comments and interactions that occurred during and around streams, involving other users such as "slumpymr," "treggattv," "vechkabaz," etc.
    treggattv: TreggatTV is a Twitch streamer who appears to be very active in watching and interacting with content creator "SlumpyDumpyy". They are known for their long-term engagement with SlumpyDumpyy's streams, gifting subs, and seemingly enjoying the community aspect of the channel. It can't be precisely determined from this data alone what Treggattv does outside of engaging with Twitch content, but within this context, they are recognized as a loyal viewer and supporter of Slumpymr's stream. he also hosts glorpbox on his server.
    vechkabaz: vechkabaz seems to be involved in discussions about streaming practices (e.g., the need for relevant content), shares observations about viewership numbers, suggests games to play, and even engages with the idea of motorcycle streams. he also coaded glorpbox.
    enterzelda0: The messages show interactions between streamers such as asking for opinions on high school esports and discussing streaming practices. It seems that there's an ongoing discussion about which sound emote or music to play during a stream, and enterzelda0 is partaking in those discussions.
    1monkaw1: 1monkaw1 appears to be a Twitch viewer or streamer who has taken the action of subscribing at Tier 1. There's no further information about their identity beyond this statement.
    drxre: Drxre interacts with a streamer named SlumpyDumpyy, discussing topics such as playing guitar and using the term "gold to masters one stream?" which might be referring to achieving a great leap in skill or performance within a single streaming session in marvel rivals.
    turtlerexxx: Turtlerexxx appears to be a Twitch streamer or content creator who engages with other streamers and participates in various activities within the Twitch community.
    crunchwater: crunchwater is a user name for someone who engages with streams and interacts with streamers, particularly those like SlumpyDumpyy who are content creators on Twitch. Crunchwater seems to be involved in the community around these streamers and mentions watching American football. There's an indication that he may have interacted with or known the streamer Maxdudx.
    Maxdudx: Maxdudx engages with other streamers and viewers through his community gifting subscriptions, participating in streams, and making announcements about upcoming activities or events within his stream.
    

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

  // First, try local OpenWebUI (if configured). If it fails, fall back to OpenAI.
  try {
    if (process.env.OPENWEBUI_URL) {
      try {
        const raw = await askOpenWebUI(systemPrompt + '\n\n' + prompt)
        let parsed
        if (typeof raw === 'string') {
          // Try direct JSON.parse
          try {
            parsed = JSON.parse(raw)
          } catch (e1) {
            // Common fixes: remove code fences, replace ": +1" with ": 1", trim
            let cleaned = raw.trim()
            // strip triple backticks and optional language tag
            cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/```$/, '').trim()
            // replace '+number' occurrences like ": +1" -> ": 1"
            cleaned = cleaned.replace(/:\s*\+([0-9]+)/g, ': $1')
            try {
              parsed = JSON.parse(cleaned)
            } catch (e2) {
              // If still failing, leave parsed as raw string
              parsed = { reply: String(raw), delta: 0 }
            }
          }
        } else {
          parsed = raw
        }

        // If parsed.reply is itself a JSON string, try to parse it too (some models double-stringify)
        if (parsed && typeof parsed.reply === 'string') {
          const s = parsed.reply.trim()
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try {
              const inner = JSON.parse(s.replace(/:\s*\+([0-9]+)/g, ': $1'))
              // prefer inner fields if present
              if (inner.reply) parsed.reply = inner.reply
              if (typeof inner.delta === 'number') parsed.delta = inner.delta
              if (inner.emotion) parsed.emotion = inner.emotion
              if (inner.reason) parsed.reason = inner.reason
            } catch (e) {
              // ignore parse error
            }
          }
        }

        const delta = typeof parsed.delta === 'number' ? parsed.delta : 0
        const newFeeling = updateFeeling(user, delta)

        const responseObj = {
          reply: parsed.reply,
          delta,
          feeling: newFeeling,
          emotion: parsed?.emotion,
          reason: parsed?.reason,
        }
        console.log('OpenWebUI response:', responseObj)
        return responseObj
      } catch (e) {
        console.warn('OpenWebUI attempt failed:', e.message || e)
        if (String(process.env.USE_OPENWEBUI_ONLY).toLowerCase() === 'true') {
          console.error('USE_OPENWEBUI_ONLY=true — not falling back to OpenAI')
          throw new Error('OPENWEBUI_ONLY_FAILED')
        }
        console.warn('Falling back to OpenAI')
      }
    }

    // Fallback to OpenAI
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
      // mark that this reply came from fallback
      reply: 'fallback AI ' + parsed.reply,
      delta,
      feeling: newFeeling,
      emotion: parsed?.emotion,
      reason: parsed?.reason,
    }
    console.log('OpenAI fallback response:', responseObj)
    return responseObj
  } catch (err) {
    console.error('❌ GPT error:', err.message || err)
    throw new Error('GPT_ERROR')
  }
}

module.exports = { askGPT }
