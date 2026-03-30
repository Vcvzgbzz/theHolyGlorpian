const { OpenAI } = require('openai')
const crypto = require('crypto')
const { getFeeling, updateFeeling } = require('../utils/userFeelings')
const { askOllama } = require('./ollama')
const { askOpenWebUI } = require('./openwebui')
require('dotenv').config({ quiet: true })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
const LOG_VERBOSE_AI = String(process.env.LOG_VERBOSE_AI || '').toLowerCase() === 'true'
const DEFAULT_CORE_IDENTITY_PROMPT = `
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
`

function normalizeMultilinePrompt(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .trim()
}

function getCoreIdentityConfig() {
  const override = normalizeMultilinePrompt(process.env.GLORP_CORE_IDENTITY_PROMPT)
  if (override) {
    return {
      source: 'env',
      text: override,
    }
  }

  return {
    source: 'default',
    text: DEFAULT_CORE_IDENTITY_PROMPT.trim(),
  }
}

function buildPromptVersion(systemPrompt, userPrompt) {
  const hash = crypto
    .createHash('sha1')
    .update(String(systemPrompt || ''))
    .update('\n---USER-PROMPT---\n')
    .update(String(userPrompt || ''))
    .digest('hex')
    .slice(0, 12)

  return `prompt-${hash}`
}

function normalizeProvider(value) {
  const provider = String(value || '').toLowerCase().trim()
  if (provider === 'ollama' || provider === 'openwebui') {
    return provider
  }
  return 'ollama'
}

function parseModelReply(raw) {
  let parsed
  if (typeof raw === 'string') {
    // Try direct JSON.parse
    try {
      parsed = JSON.parse(raw)
    } catch (e1) {
      // Common fixes: remove code fences, replace ": +1" with ": 1", trim
      let cleaned = raw.trim()
      cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/```$/, '').trim()
      cleaned = cleaned.replace(/:\s*\+([0-9]+)/g, ': $1')
      try {
        parsed = JSON.parse(cleaned)
      } catch (e2) {
        parsed = { reply: String(raw), delta: 0 }
      }
    }
  } else {
    parsed = raw
  }

  if (parsed && typeof parsed.reply === 'string') {
    const s = parsed.reply.trim()
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        const inner = JSON.parse(s.replace(/:\s*\+([0-9]+)/g, ': $1'))
        if (inner.reply) parsed.reply = inner.reply
        if (typeof inner.delta === 'number') parsed.delta = inner.delta
        if (inner.emotion) parsed.emotion = inner.emotion
        if (inner.reason) parsed.reason = inner.reason
      } catch (e) {
        // ignore parse error
      }
    }
  }

  return parsed || { reply: 'Glorp error occurred.', delta: 0 }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getToneBand(temperament) {
  if (temperament <= 3) return 'cold_guarded'
  if (temperament <= 6) return 'neutral_chaotic'
  if (temperament <= 8) return 'playful_warm'
  return 'loyal_hype'
}

function formatRecentChatContext(recentChat) {
  const rows = Array.isArray(recentChat) ? recentChat : []
  if (rows.length === 0) {
    return {
      lineCount: 0,
      text: 'n/a',
    }
  }

  const lines = rows.slice(-20).map((row) => {
    const role = String(row?.speakerType || 'user').toLowerCase() === 'bot' ? 'bot' : 'user'
    const name = String(row?.username || 'unknown').slice(0, 32)
    const text = String(row?.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)

    return `- [${role}] ${name}: ${text}`
  })

  return {
    lineCount: lines.length,
    text: lines.join('\n'),
  }
}

function formatRecentEchoContext(recentEcho) {
  if (!recentEcho || !recentEcho.text) {
    return {
      found: false,
      text: 'n/a',
    }
  }

  const text = String(recentEcho.text)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)

  return {
    found: true,
    text,
  }
}

function buildAdaptiveToneContext(memoryProfile) {
  if (!memoryProfile) {
    return {
      summary: {
        toneBand: 'session_only',
        temperament: null,
        userWeight: 0,
        channelWeight: 0,
        userDelta30d: null,
        channelDelta7d: null,
        blendedDelta: null,
        themes: 'n/a',
      },
      context: `
  User memory profile: unavailable.
  Tone adaptation rule: use current session feeling only.
  Safety rule: Never produce hateful, sexual explicit, violent threatening, self-harm encouraging, doxxing, or targeted abusive language.
  `,
    }
  }

  const avgDelta7d = Number(memoryProfile.avgDelta7d || 0)
  const avgDelta30d = Number(memoryProfile.avgDelta30d || 0)
  const insultRate30d = Number(memoryProfile.insultRate30d || 0)
  const askCount30d = Number(memoryProfile.askCount30d || 0)
  const avgFeeling30d = Number(memoryProfile.avgFeeling30d || 5)
  const glorpUses30d = Number(memoryProfile.glorpUses30d || 0)
  const slotsUses30d = Number(memoryProfile.slotsUses30d || 0)
  const lootboxUses30d = Number(memoryProfile.lootboxUses30d || 0)
  const channelMood7d = memoryProfile.channelMood7d || {}
  const channelAvgDelta7d = Number(channelMood7d.avgDelta || 0)
  const channelAvgFeeling7d = Number(channelMood7d.avgFeeling || 5)
  const channelSafetyRate7d = Number(channelMood7d.safetyRate || 0)
  const channelAskCount7d = Number(channelMood7d.askCount || 0)
  const channelTopThemes = Array.isArray(channelMood7d.topThemes)
    ? channelMood7d.topThemes.slice(0, 3).map((t) => t.theme).filter(Boolean)
    : []
  const recentChat = Array.isArray(memoryProfile.recentChat) ? memoryProfile.recentChat : []
  const recentChatMeta = memoryProfile.recentChatMeta || {}
  const formattedRecentChat = formatRecentChatContext(recentChat)
  const recentEcho = memoryProfile.recentEcho || null
  const recentEchoMeta = memoryProfile.recentEchoMeta || {}
  const formattedRecentEcho = formatRecentEchoContext(recentEcho)
  const sentimentTrend = Array.isArray(channelMood7d.sentimentTrend)
    ? channelMood7d.sentimentTrend.slice(-3)
    : []
  const weights = memoryProfile.weights || {}
  const userWeight = Number(weights.user || 0.4)
  const channelWeight = Number(weights.channel || 0.6)
  const blendedMood = memoryProfile.blendedMood || {}
  const blendedAvgDelta = Number(blendedMood.avgDelta || avgDelta30d)
  const blendedAvgFeeling = Number(blendedMood.avgFeeling || avgFeeling30d)
  const blendedInsultRate = Number(blendedMood.insultRate || insultRate30d)

  const userTemperament = 5 + avgDelta30d * 2 + avgDelta7d * 1 - insultRate30d * 2.5
  const channelTemperament =
    5 + channelAvgDelta7d * 2 + (channelAvgFeeling7d - 5) * 0.75 - channelSafetyRate7d * 2.5

  const temperament = clamp(
    userTemperament * userWeight + channelTemperament * channelWeight,
    1,
    10,
  )

  const toneBand = getToneBand(temperament)

  return {
    summary: {
      toneBand,
      temperament: Number(temperament.toFixed(2)),
      userWeight: Number((userWeight * 100).toFixed(0)),
      channelWeight: Number((channelWeight * 100).toFixed(0)),
      userDelta30d: Number(avgDelta30d.toFixed(2)),
      channelDelta7d: Number(channelAvgDelta7d.toFixed(2)),
      blendedDelta: Number(blendedAvgDelta.toFixed(2)),
      blendedFeeling: Number(blendedAvgFeeling.toFixed(2)),
      channelSafetyRate7d: Number(channelSafetyRate7d.toFixed(3)),
      themes: channelTopThemes.length ? channelTopThemes.join(' | ') : 'n/a',
      recentChatCount: recentChat.length,
      recentChatUsed: formattedRecentChat.lineCount,
      recentChatSource: String(recentChatMeta.source || 'n/a'),
      recentEchoFound: formattedRecentEcho.found,
      recentEchoSource: String(recentEchoMeta.source || 'n/a'),
    },
    context: `
  Persistent user memory profile (30d unless noted):
  - avg_delta_7d: ${avgDelta7d.toFixed(2)}
  - avg_delta_30d: ${avgDelta30d.toFixed(2)}
  - insult_proxy_rate_30d: ${insultRate30d.toFixed(2)}
  - avg_feeling_30d: ${avgFeeling30d.toFixed(2)}
  - ask_count_30d: ${askCount30d}
  - !glorpbox_uses_30d: ${glorpUses30d}
  - !slots_uses_30d: ${slotsUses30d}
  - !lootbox_uses_30d: ${lootboxUses30d}
  
  Channel mood digest (7d):
  - channel_avg_delta_7d: ${channelAvgDelta7d.toFixed(2)}
  - channel_avg_feeling_7d: ${channelAvgFeeling7d.toFixed(2)}
  - channel_safety_rate_7d: ${channelSafetyRate7d.toFixed(3)}
  - channel_ask_count_7d: ${channelAskCount7d}
  - top_channel_themes: ${channelTopThemes.length ? channelTopThemes.join(' | ') : 'n/a'}
  - recent_sentiment_trend: ${sentimentTrend.length ? sentimentTrend.map((row) => `${row.day}:${Number(row.avg_delta || 0).toFixed(2)}`).join(' | ') : 'n/a'}

  Weighted mood blend (prioritize room context):
  - user_weight: ${(userWeight * 100).toFixed(0)}%
  - channel_weight: ${(channelWeight * 100).toFixed(0)}%
  - blended_avg_delta: ${blendedAvgDelta.toFixed(2)}
  - blended_avg_feeling: ${blendedAvgFeeling.toFixed(2)}
  - blended_insult_rate: ${blendedInsultRate.toFixed(3)}
  - derived_temperament: ${temperament.toFixed(2)}/10
  - tone_band: ${toneBand}

  Recent channel chat context (selected):
  - context_source: ${String(recentChatMeta.source || 'n/a')}
  - context_messages_available: ${recentChat.length}
  - context_messages_used: ${formattedRecentChat.lineCount}
${formattedRecentChat.text}

  Memory echo context (if available):
  - echo_source: ${String(recentEchoMeta.source || 'n/a')}
  - echo_found: ${formattedRecentEcho.found ? 'yes' : 'no'}
  - echo_text: ${formattedRecentEcho.text}

  Tone adaptation rules:
  - Let the channel mood influence style more than individual mood (60% channel / 40% user).
  - If tone_band is cold_guarded: be brief, strict, and sarcastic, but never abusive.
  - If tone_band is neutral_chaotic: playful but measured.
  - If tone_band is playful_warm: add encouragement and humor.
  - If tone_band is loyal_hype: friendly and celebratory.

  Absolute safety rule:
  - Never produce hateful, sexual explicit, violent threatening, self-harm encouraging, doxxing, or targeted abusive language.
  - If provoked, keep boundaries firm and Twitch-safe instead of escalating.
  `,
  }
}

function buildSystemPrompt(prompt, user, currentFeeling, adaptiveToneContext) {
  const coreIdentity = getCoreIdentityConfig()

  const systemPrompt = `
  ${coreIdentity.text}

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

  ${adaptiveToneContext}

  Only return a JSON response like:
  {
    "reply": "your Glorp or other fitting style as appropriate response",
    "delta": [number between -2 and +2 based on your judgment of their message],
    "reason": "optional explanation for your judgment",
    "emotion": "optional emotion word"
  }
  `

  const promptVersion = buildPromptVersion(systemPrompt, prompt)
  return {
    systemPrompt,
    promptVersion,
    coreIdentitySource: coreIdentity.source,
    coreIdentityChars: coreIdentity.text.length,
  }
}

function inspectPrompt(prompt, user, memoryProfile = null) {
  const currentFeeling = getFeeling(user)
  const { context: adaptiveToneContext, summary: promptSummary } = buildAdaptiveToneContext(memoryProfile)
  const promptBuild = buildSystemPrompt(prompt, user, currentFeeling, adaptiveToneContext)

  return {
    currentFeeling,
    promptVersion: promptBuild.promptVersion,
    promptChars: promptBuild.systemPrompt.length + String(prompt || '').length,
    coreIdentitySource: promptBuild.coreIdentitySource,
    coreIdentityChars: promptBuild.coreIdentityChars,
    summary: {
      ...promptSummary,
      promptVersion: promptBuild.promptVersion,
      coreIdentitySource: promptBuild.coreIdentitySource,
      coreIdentityChars: promptBuild.coreIdentityChars,
    },
    systemPrompt: promptBuild.systemPrompt,
    adaptiveToneContext,
  }
}

async function askGPT(prompt, user, memoryProfile = null) {
  const promptInspection = inspectPrompt(prompt, user, memoryProfile)
  const currentFeeling = promptInspection.currentFeeling
  const promptVersion = promptInspection.promptVersion
  const systemPrompt = promptInspection.systemPrompt

  console.log('[gpt] prompt', {
    user,
    currentFeeling,
    ...promptInspection.summary,
  })
  if (LOG_VERBOSE_AI) {
    console.log('[gpt] prompt.verbose', promptInspection.adaptiveToneContext.trim())
  }

  // Try selected local provider first, then OpenAI as final fallback.
  try {
    const provider = normalizeProvider(process.env.LLM_PROVIDER)
    console.log('[gpt] route', {
      promptVersion,
      provider,
      fallback: 'openai',
      promptChars: systemPrompt.length + String(prompt || '').length,
    })

    if (provider === 'ollama') {
      try {
        const raw = await askOllama(systemPrompt + '\n\n' + prompt)
        const parsed = parseModelReply(raw)

        const delta = typeof parsed.delta === 'number' ? parsed.delta : 0
        const newFeeling = updateFeeling(user, delta)

        const responseObj = {
          reply: parsed.reply,
          delta,
          feeling: newFeeling,
          emotion: parsed?.emotion,
          reason: parsed?.reason,
        }
        console.log('[gpt] response', {
          provider: 'ollama',
          promptVersion,
          delta,
          feeling: newFeeling,
          emotion: responseObj.emotion || 'n/a',
          replyChars: String(responseObj.reply || '').length,
        })
        if (LOG_VERBOSE_AI) {
          console.log('[gpt] response.verbose', responseObj)
        }
        return responseObj
      } catch (e) {
        console.warn('Ollama attempt failed:', {
          message: e.message || 'UNKNOWN_OLLAMA_ERROR',
          code: e.code,
          meta: e.meta,
          cause: e.cause?.message,
        })
        if (String(process.env.USE_OLLAMA_ONLY).toLowerCase() === 'true') {
          console.error('USE_OLLAMA_ONLY=true - not falling back to OpenAI')
          throw new Error('OLLAMA_ONLY_FAILED')
        }
      }
    }

    if (provider === 'openwebui') {
      try {
        const raw = await askOpenWebUI(systemPrompt + '\n\n' + prompt)
        const parsed = parseModelReply(raw)

        const delta = typeof parsed.delta === 'number' ? parsed.delta : 0
        const newFeeling = updateFeeling(user, delta)

        const responseObj = {
          reply: parsed.reply,
          delta,
          feeling: newFeeling,
          emotion: parsed?.emotion,
          reason: parsed?.reason,
        }
        console.log('[gpt] response', {
          provider: 'openwebui',
          promptVersion,
          delta,
          feeling: newFeeling,
          emotion: responseObj.emotion || 'n/a',
          replyChars: String(responseObj.reply || '').length,
        })
        if (LOG_VERBOSE_AI) {
          console.log('[gpt] response.verbose', responseObj)
        }
        return responseObj
      } catch (e) {
        console.warn('OpenWebUI attempt failed:', e.message || 'UNKNOWN_OPENWEBUI_ERROR')
        if (String(process.env.USE_OPENWEBUI_ONLY).toLowerCase() === 'true') {
          console.error('USE_OPENWEBUI_ONLY=true - not falling back to OpenAI')
          throw new Error('OPENWEBUI_ONLY_FAILED')
        }
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
    console.log('[gpt] response', {
      provider: 'openai-fallback',
      promptVersion,
      delta,
      feeling: newFeeling,
      emotion: responseObj.emotion || 'n/a',
      replyChars: String(responseObj.reply || '').length,
    })
    if (LOG_VERBOSE_AI) {
      console.log('[gpt] response.verbose', responseObj)
    }
    return responseObj
  } catch (err) {
    console.error('❌ GPT error:', err.message || err)
    throw new Error('GPT_ERROR')
  }
}

module.exports = { askGPT, inspectPrompt }
