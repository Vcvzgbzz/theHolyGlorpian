const ERROR_MESSAGES = {
  TOO_MANY_PENDING_REQUESTS: 'Please wait for your current requests to finish.',
  RATE_LIMITED:
    'You have been rate limited, please slow down the use of commands',
  TIMEOUT: 'The request took too long and was canceled.',
  API_ERROR: 'Something went wrong with the API.',
  UNKNOWN: 'An unknown error occurred.',
}

function getErrorMessage(code, username) {
  if (typeof code === 'string' && !(code in ERROR_MESSAGES)) {
    const custom = code.replace(/^Error:\s*/, '').trim()
    if (custom) {
      return username ? `@${username}, ${custom}` : custom
    }
  }

  const base = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN
  return username ? `@${username}, ${base}` : base
}

module.exports = { getErrorMessage }
