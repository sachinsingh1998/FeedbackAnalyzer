const API_BASE = '/api'

async function handleResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.detail || `Request failed (${response.status})`)
  }
  return response.json()
}

export async function uploadCsv(peerFile, masterFile) {
  const formData = new FormData()
  formData.append('peer_file', peerFile, peerFile.name)
  formData.append('master_file', masterFile, masterFile.name)
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

export async function fetchStudents(sessionId) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/students`)
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
