function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function getRelationshipDetails(summary) {
  const totalAsks = toNumber(summary?.glorp?.total_asks, 0)
  const avgDelta = toNumber(summary?.glorp?.avg_delta, 0)
  const avgFeeling = toNumber(summary?.glorp?.avg_feeling, 5)
  const safetyBlocks = toNumber(summary?.glorp?.safety_blocks, 0)
  const safetyBlockRate = totalAsks > 0 ? safetyBlocks / totalAsks : 0

  const metrics = {
    totalAsks,
    avgDelta,
    avgFeeling,
    safetyBlocks,
    safetyBlockRate,
  }

  if (totalAsks <= 0) {
    return {
      key: 'unknown',
      text: "GlorpBox doesn't know you",
      guide: 'Ask !glorpbox questions to build your slime history.',
      metrics,
    }
  }

  if (safetyBlockRate >= 0.35 || avgDelta <= -1.2 || avgFeeling <= 2.5) {
    return {
      key: 'banish',
      text: 'GlorpBox wants you far from the slime altar',
      guide: 'Major reset needed: avoid hostile or unsafe prompts and keep asks respectful for several rounds.',
      metrics,
    }
  }

  if (safetyBlockRate >= 0.15 || avgDelta <= -0.4 || avgFeeling <= 4) {
    return {
      key: 'distrust',
      text: 'GlorpBox distrusts you',
      guide: 'Use on-topic, non-abusive prompts; fewer safety blocks and better deltas will improve this state.',
      metrics,
    }
  }

  if (avgDelta < 0.35 || avgFeeling < 5.6) {
    return {
      key: 'watching',
      text: 'GlorpBox is watching you carefully',
      guide: 'You are close. Keep asks constructive and Glorp-aligned to move into likes-you territory.',
      metrics,
    }
  }

  if (avgDelta < 1.1 || avgFeeling < 7.5) {
    return {
      key: 'likes',
      text: 'GlorpBox likes you',
      guide: 'To level up: stay consistent with positive, respectful asks and avoid safety strikes.',
      metrics,
    }
  }

  return {
    key: 'favored',
    text: 'GlorpBox favors you greatly',
    guide: 'Maintain this by keeping high-quality asks and a clean safety record.',
    metrics,
  }
}

module.exports = {
  getRelationshipDetails,
}