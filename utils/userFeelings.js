const userFeelings = new Map()

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getFeeling(username) {
  return userFeelings.get(username) ?? 5
}

function updateFeeling(username, delta) {
  const current = getFeeling(username)
  const newScore = clamp(current + delta, 1, 10)
  userFeelings.set(username, newScore)
  return newScore
}

function getFeelingDescriptor(score) {
  if (score >= 8) return 'radiantly slime-happy 🟢'
  if (score >= 6) return 'pleased and glo’d up 🟢'
  if (score >= 4) return 'neutral and contemplative 🟡'
  if (score >= 2) return 'irritated and goopy 🔴'
  return 'furious with Glorpling insolence 🔥'
}

module.exports = { getFeeling, updateFeeling, getFeelingDescriptor }
