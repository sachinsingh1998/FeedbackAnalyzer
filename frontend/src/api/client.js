const API_BASE = '/api'

async function handleResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.detail || 'Request failed')
  }
  return response.json()
}

export async function uploadCsv(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse(response)
}

export async function fetchGroups(sessionId) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/groups`)
  return handleResponse(response)
}

export async function fetchGroup(sessionId, groupName) {
  const response = await fetch(
    `${API_BASE}/sessions/${sessionId}/groups/${encodeURIComponent(groupName)}`,
  )
  return handleResponse(response)
}

export async function fetchMemberFeedback(sessionId, groupName, zid) {
  const response = await fetch(
    `${API_BASE}/sessions/${sessionId}/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(zid)}/feedback`,
  )
  return handleResponse(response)
}
