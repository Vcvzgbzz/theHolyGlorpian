require('dotenv').config({ quiet: true })

const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 30000
const LOG_VERBOSE_AI = String(process.env.LOG_VERBOSE_AI || '').toLowerCase() === 'true'

function clip(value, max = 300) {
  const str = String(value || '')
  return str.length > max ? `${str.slice(0, max)}...` : str
}

function createError(code, meta = {}, cause) {
  const error = new Error(code)
  error.code = code
  error.meta = meta
  if (cause) {
    error.cause = cause
  }
  return error
}

function getOllamaChatUrl() {
  const baseUrl = (process.env.OLLAMA_URL || '').trim()

  if (!baseUrl) {
    throw new Error('OLLAMA_URL_MISSING')
  }

  const normalized = baseUrl.replace(/\/+$/, '')

  if (normalized.endsWith('/api/chat')) {
    return normalized
  }

  if (normalized.endsWith('/api')) {
    return `${normalized}/chat`
  }

  return `${normalized}/api/chat`
}

function extractReply(payload) {
  const messageContent = payload?.message?.content
  if (typeof messageContent === 'string') {
    return messageContent
  }

  const choiceContent = payload?.choices?.[0]?.message?.content
  if (typeof choiceContent === 'string') {
    return choiceContent
  }

  return ''
}

async function askOllama(prompt) {
  const model = (process.env.OLLAMA_MODEL || '').trim()
  const url = getOllamaChatUrl()
  const startedAt = Date.now()
  const promptChars = prompt ? String(prompt).length : 0

  if (!model) {
    throw createError('OLLAMA_MODEL_MISSING', { model })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  console.log('[Ollama] start', {
    model,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    promptChars,
  })
  if (LOG_VERBOSE_AI) {
    console.log('[Ollama] start.verbose', { url, model, timeoutMs: DEFAULT_TIMEOUT_MS, promptChars })
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const elapsedMs = Date.now() - startedAt

    if (!response.ok) {
      const detail =
        typeof payload === 'string'
          ? payload.slice(0, 300)
          : JSON.stringify(payload).slice(0, 300)
      throw createError('OLLAMA_HTTP_ERROR', {
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        url,
        model,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        promptChars,
        detail,
      })
    }

    const reply = extractReply(payload)
    if (!reply) {
      throw createError('OLLAMA_EMPTY_RESPONSE', {
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        url,
        model,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        promptChars,
      })
    }

    console.log('[Ollama] success', {
      status: response.status,
      elapsedMs,
      replyChars: reply.length,
    })
    if (LOG_VERBOSE_AI) {
      console.log('[Ollama] success.verbose', {
        status: response.status,
        ok: response.ok,
        elapsedMs,
        bytes: responseText ? responseText.length : 0,
      })
    }

    return reply
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createError('OLLAMA_TIMEOUT', {
        elapsedMs: Date.now() - startedAt,
        url,
        model,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        promptChars,
      })
    }

    if (error?.code && error?.meta) {
      throw error
    }

    throw createError(
      'OLLAMA_REQUEST_FAILED',
      {
        elapsedMs: Date.now() - startedAt,
        url,
        model,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        promptChars,
        fetchErrorName: error?.name,
        fetchErrorMessage: clip(error?.message || error),
      },
      error
    )
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { askOllama }