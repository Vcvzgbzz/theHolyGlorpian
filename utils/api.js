const fetch = require('node-fetch')
require('dotenv').config({ quiet: true })

const BASE_URL = process.env.BASE_URL
const pendingRequests = new Map()
const MAX_PENDING = 2
const userLastRequest = new Map() // rate limiting stuff
const REQUEST_COOLDOWN_MS = 1000

function getUserId(tags) {
  return tags['user-id'] || tags.username
}

function canProceed(userId) {
  const current = pendingRequests.get(userId) || 0
  return current < MAX_PENDING
}

function addPending(userId) {
  const current = pendingRequests.get(userId) || 0
  pendingRequests.set(userId, current + 1)
}

function removePending(userId) {
  const current = pendingRequests.get(userId) || 0
  if (current <= 1) {
    pendingRequests.delete(userId)
  } else {
    pendingRequests.set(userId, current - 1)
  }
}
function isRateLimited(userId) {
  const lastRequest = userLastRequest.get(userId) || 0
  const now = Date.now()
  return now - lastRequest < REQUEST_COOLDOWN_MS
}

function updateLastRequest(userId) {
  userLastRequest.set(userId, Date.now())
}

async function callApi(endpoint, channel, tags, extraParams = []) {
  const userId = getUserId(tags)

  if (isRateLimited(userId)) {
    throw new Error('RATE_LIMITED')
  }

  if (!canProceed(userId)) {
    throw new Error('TOO_MANY_PENDING_REQUESTS')
  }

  addPending(userId)
  updateLastRequest(userId)
  const rawChannel = channel.startsWith('#') ? channel.slice(1) : channel

  let url =
    `${BASE_URL}/${endpoint}` +
    `?username=${encodeURIComponent(tags.username)}` +
    `&userId=${encodeURIComponent(userId)}` +
    `&channelId=${encodeURIComponent(rawChannel)}` +
    `&textMode=true`

  if (Array.isArray(extraParams)) {
    extraParams.forEach((paramObj) => {
      for (const [key, value] of Object.entries(paramObj)) {
        url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      }
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    console.log('Auto abort timeout...')
    controller.abort()
  }, 7000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Error Calling api: ${url} ${response.status}`)
    }

    return await response.text()
  } catch (err) {
    throw err
  } finally {
    removePending(userId)
  }
}

async function postApi(endpoint, payload) {
  if (!BASE_URL) {
    throw new Error('BASE_URL_MISSING')
  }

  const url = `${BASE_URL}/${endpoint}`

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 7000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Error Posting api: ${url} ${response.status} ${text.slice(0, 120)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return await response.json()
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function getApiJson(endpoint, queryParams = {}) {
  if (!BASE_URL) {
    throw new Error('BASE_URL_MISSING')
  }

  const query = new URLSearchParams()
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.append(key, String(value))
  })

  const url = `${BASE_URL}/${endpoint}${query.toString() ? `?${query.toString()}` : ''}`
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 7000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Error Getting api: ${url} ${response.status} ${text.slice(0, 120)}`)
    }

    if (!text) return {}

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON response from ${endpoint}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { callApi, postApi, getApiJson }
