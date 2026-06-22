function formatDateTime(value) {
  if (!value) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatShortDate(value) {
  if (!value) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
    return '0m'
  }

  const wholeSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`
}

function formatTurnTime(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
    return '--:--'
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function getScoreTone(score) {
  if (typeof score !== 'number') {
    return 'neutral'
  }

  if (score > 80) {
    return 'pass'
  }

  if (score > 60) {
    return 'warn'
  }

  return 'fail'
}

function formatScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'N/A'
  }

  return `${Math.round(score)}`
}

function humanizeCategory(value) {
  return String(value || 'general')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export {
  formatDateTime,
  formatDuration,
  formatScore,
  formatShortDate,
  formatTurnTime,
  getScoreTone,
  humanizeCategory,
}
