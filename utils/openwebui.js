require('dotenv').config({ quiet: true })

const DEFAULT_TIMEOUT_MS = 20000

function getChatCompletionsUrl() {
  const baseUrl = (process.env.OPENWEBUI_URL || '').trim()

  if (!baseUrl) {
    throw new Error('OPENWEBUI_URL_MISSING')
  }

  const normalized = baseUrl.replace(/\/+$/, '')

  if (normalized.endsWith('/api/chat/completions')) {
    return normalized
  }

  if (normalized.endsWith('/api')) {
    return `${normalized}/chat/completions`
  }

  return `${normalized}/api/chat/completions`
}

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  const apiKey = (process.env.OPENWEBUI_API_KEY || '').trim()
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

function normalizeContent(content) {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part.text === 'string') {
          return part.text
        }

        return ''
      })
      .join('')
      .trim()
  }

  return ''
}

function extractReply(payload) {
  const choiceContent = payload?.choices?.[0]?.message?.content
  if (choiceContent !== undefined) {
    return normalizeContent(choiceContent)
  }

  const directMessage = payload?.message?.content
  if (directMessage !== undefined) {
    return normalizeContent(directMessage)
  }

  if (typeof payload === 'string') {
    return payload
  }

  return ''
}

async function askOpenWebUI(prompt) {
  const model = (process.env.OPENWEBUI_MODEL || '').trim()

  if (!model) {
    throw new Error('OPENWEBUI_MODEL_MISSING')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(getChatCompletionsUrl(), {
      method: 'POST',
      headers: buildHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const responseText = await response.text()
    let payload

    try {
      payload = responseText ? JSON.parse(responseText) : {}
    } catch {
      payload = responseText
    }

    if (!response.ok) {
      const detail =
        typeof payload === 'string'
          ? payload.slice(0, 300)
          : JSON.stringify(payload).slice(0, 300)
      throw new Error(`OPENWEBUI_HTTP_${response.status}: ${detail}`)
    }

    const reply = extractReply(payload)
    if (!reply) {
      throw new Error('OPENWEBUI_EMPTY_RESPONSE')
    }

    return reply
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('OPENWEBUI_TIMEOUT')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { askOpenWebUI }