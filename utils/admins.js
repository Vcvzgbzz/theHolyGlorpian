require('dotenv').config({ quiet: true })

const DEFAULT_ADMINS = ['vechkabaz', 'treggattv']

function normalizeList(items) {
  return items
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function parseAdminList() {
  const raw = process.env.BOT_ADMIN_USERS

  if (!raw) {
    return DEFAULT_ADMINS
  }

  // Accept either JSON array or comma-separated list.
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const normalized = normalizeList(parsed)
      return normalized.length ? normalized : DEFAULT_ADMINS
    }
  } catch (err) {
    // Ignore parse errors and try CSV fallback.
  }

  const normalized = normalizeList(raw.split(','))
  return normalized.length ? normalized : DEFAULT_ADMINS
}

const ADMIN_USERS = parseAdminList()

function isAdminUser(username) {
  return ADMIN_USERS.includes(String(username || '').toLowerCase())
}

module.exports = {
  ADMIN_USERS,
  isAdminUser,
}
