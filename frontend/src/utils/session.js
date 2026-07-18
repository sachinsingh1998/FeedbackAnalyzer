const SESSION_ID_KEY = 'feedbackSessionId'
const FILENAME_KEY = 'feedbackFilename'
const GROUPS_KEY = 'feedbackGroupsCache'
const STUDENTS_KEY = 'feedbackStudentsCache'
const SELECTED_GROUP_KEY = 'feedbackSelectedGroup'

export function clearFeedbackSession() {
  sessionStorage.removeItem(SESSION_ID_KEY)
  sessionStorage.removeItem(FILENAME_KEY)
  sessionStorage.removeItem(GROUPS_KEY)
  sessionStorage.removeItem(STUDENTS_KEY)
  sessionStorage.removeItem(SELECTED_GROUP_KEY)
}

export function isSessionExpiredError(message) {
  if (!message) return false
  const lower = message.toLowerCase()
  return lower.includes('session not found') || lower.includes('upload the csv')
}

function readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function loadCachedGroups(sessionId) {
  const cached = readJson(GROUPS_KEY, null)
  if (!cached || cached.sessionId !== sessionId || !Array.isArray(cached.data)) {
    return []
  }
  return cached.data
}

export function saveCachedGroups(sessionId, groups) {
  sessionStorage.setItem(
    GROUPS_KEY,
    JSON.stringify({ sessionId, data: groups }),
  )
}

export function loadCachedStudents(sessionId) {
  const cached = readJson(STUDENTS_KEY, null)
  if (!cached || cached.sessionId !== sessionId || !Array.isArray(cached.data)) {
    return []
  }
  return cached.data
}

export function saveCachedStudents(sessionId, students) {
  sessionStorage.setItem(
    STUDENTS_KEY,
    JSON.stringify({ sessionId, data: students }),
  )
}

export function loadSelectedGroup(sessionId) {
  const cached = readJson(SELECTED_GROUP_KEY, null)
  if (!cached || cached.sessionId !== sessionId) return ''
  return cached.group || ''
}

export function saveSelectedGroup(sessionId, group) {
  if (!group) return
  sessionStorage.setItem(
    SELECTED_GROUP_KEY,
    JSON.stringify({ sessionId, group }),
  )
}
