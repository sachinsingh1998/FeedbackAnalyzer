const API_BASE = '/api'

async function handleResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const detail = payload.detail
    if (typeof detail === 'string') {
      throw new Error(detail)
    }
    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => item.msg || JSON.stringify(item))
        .join('; ')
      throw new Error(message || `Request failed (${response.status})`)
    }
    throw new Error(`Request failed (${response.status})`)
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
