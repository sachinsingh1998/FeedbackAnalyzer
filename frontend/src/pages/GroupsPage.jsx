import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchGroup, fetchGroups, fetchStudents } from '../api/client'
import GroupSearchSelect from '../components/GroupSearchSelect'
import StudentSearchSelect from '../components/StudentSearchSelect'
import Layout from '../components/Layout'
import { getScoreStyle } from '../utils/ratings'
import {
  clearFeedbackSession,
  isSessionExpiredError,
  loadCachedGroups,
  loadCachedStudents,
  loadSelectedGroup,
  saveCachedGroups,
  saveCachedStudents,
  saveSelectedGroup,
} from '../utils/session'

const AVG_COLUMNS = [
  { key: 'participation', label: 'Participation' },
  { key: 'dependability', label: 'Dependability' },
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'work_contribution', label: 'Work' },
  { key: 'overall', label: 'Overall' },
]

function formatScore(value) {
  return value == null ? '—' : value.toFixed(2)
}

function ScoreCell({ value, emphasize = false }) {
  const style = getScoreStyle(value)
  return (
    <td>
      <span
        className={`avg-score ${emphasize ? 'overall' : ''}`}
        style={{ backgroundColor: style.background, color: style.color }}
      >
        {formatScore(value)}
      </span>
    </td>
  )
}

function MemberTable({ members, groupName, unidentified = false }) {
  return (
    <div className="member-table-wrap">
      <table className="member-table">
        <thead>
          <tr>
            <th>Member</th>
            {AVG_COLUMNS.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const displayName = member.name || (unidentified ? `z${member.zid}` : 'Not found')
            const canLink = Boolean(member.name) || unidentified
            const averages = member.averages || {}

            return (
              <tr key={member.zid}>
                <td>
                  {canLink ? (
                    <Link
                      to={`/feedback/${encodeURIComponent(groupName)}/${member.zid}`}
                      className="member-link"
                    >
                      {displayName}
                    </Link>
                  ) : (
                    <span className="member-name muted">Not found</span>
                  )}
                  <p className="member-meta">z{member.zid}</p>
                  {member.email && <p className="member-meta">{member.email}</p>}
                  {unidentified && member.noted_by?.length > 0 && (
                    <p className="member-meta">
                      Entered by {member.noted_by.length} teammate
                      {member.noted_by.length === 1 ? '' : 's'}
                    </p>
                  )}
                </td>
                {AVG_COLUMNS.map((col) => (
                  <ScoreCell
                    key={col.key}
                    value={averages[col.key]}
                    emphasize={col.key === 'overall'}
                  />
                ))}
                <td>
                  {unidentified ? (
                    <span className="status-pill missing">Unidentified</span>
                  ) : (
                    <span className={`status-pill ${member.submitted ? 'submitted' : 'missing'}`}>
                      {member.submitted ? 'Submitted' : 'No submission'}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const sessionId = sessionStorage.getItem('feedbackSessionId')
  const filename = sessionStorage.getItem('feedbackFilename')
  const [groups, setGroups] = useState(() => (sessionId ? loadCachedGroups(sessionId) : []))
  const [students, setStudents] = useState(() => (sessionId ? loadCachedStudents(sessionId) : []))
  const [selectedGroup, setSelectedGroup] = useState(() =>
    sessionId ? loadSelectedGroup(sessionId) : '',
  )
  const [members, setMembers] = useState([])
  const [unidentified, setUnidentified] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(() => {
    if (!sessionId) return true
    return loadCachedGroups(sessionId).length === 0
  })
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }

    let active = true

    async function loadGroups() {
      const hasCache = loadCachedGroups(sessionId).length > 0
      if (!hasCache) setLoadingGroups(true)
      setError('')
      try {
        const groupData = await fetchGroups(sessionId)
        if (!active) return
        setGroups(groupData)
        saveCachedGroups(sessionId, groupData)

        setSelectedGroup((current) => {
          const next = current || loadSelectedGroup(sessionId) || groupData[0]?.name || ''
          if (next) saveSelectedGroup(sessionId, next)
          return next
        })
        setLoadingGroups(false)

        const studentData = await fetchStudents(sessionId)
        if (!active) return
        setStudents(studentData)
        saveCachedStudents(sessionId, studentData)
      } catch (err) {
        if (!active) return
        if (isSessionExpiredError(err.message)) {
          clearFeedbackSession()
          navigate('/', { replace: true })
          return
        }
        // Keep cached students/groups if refresh fails.
        if (loadCachedStudents(sessionId).length === 0) {
          setError(err.message)
        }
        setLoadingGroups(false)
      }
    }

    loadGroups()
    return () => {
      active = false
    }
  }, [sessionId, navigate])

  useEffect(() => {
    if (!sessionId || !selectedGroup) {
      return
    }

    saveSelectedGroup(sessionId, selectedGroup)

    let active = true

    async function loadMembers() {
      setLoadingMembers(true)
      setError('')
      try {
        const data = await fetchGroup(sessionId, selectedGroup)
        if (!active) return
        setMembers(data.members)
        setUnidentified(data.unidentified_members || [])
      } catch (err) {
        if (!active) return
        if (isSessionExpiredError(err.message)) {
          clearFeedbackSession()
          navigate('/', { replace: true })
          return
        }
        setError(err.message)
        setMembers([])
        setUnidentified([])
      } finally {
        if (active) setLoadingMembers(false)
      }
    }

    loadMembers()
    return () => {
      active = false
    }
  }, [sessionId, selectedGroup, navigate])

  return (
    <Layout
      title="Group Overview"
      subtitle={filename ? `Analyzing ${filename}` : 'Select a group to inspect member feedback.'}
      backTo="/"
      backLabel="Upload"
    >
      <section className="panel group-select-panel">
        <div className="selector-grid">
          <div>
            <label className="field-label" htmlFor="group-search">
              Select group
            </label>
            <GroupSearchSelect
              groups={groups}
              value={selectedGroup}
              onChange={setSelectedGroup}
              disabled={false}
            />
          </div>
          <div>
            <label className="field-label">
              Find student
            </label>
            <StudentSearchSelect
              students={students}
              disabled={false}
              onSelect={(student) => setSelectedGroup(student.group)}
            />
          </div>
        </div>
        {loadingGroups && groups.length === 0 && (
          <p className="loading-text" style={{ marginTop: 12 }}>Loading groups…</p>
        )}
        {!loadingGroups && students.length === 0 && (
          <p className="loading-text" style={{ marginTop: 12 }}>
            Student search list is empty — open a group once, or re-upload the CSVs.
          </p>
        )}
      </section>

      {error && <p className="error-banner">{error}</p>}

      <section className="panel">
        <div className="panel-heading">
          <h2>Team Members</h2>
          {!loadingMembers && selectedGroup && (
            <span className="chip">{members.length} members</span>
          )}
        </div>
        <p className="section-note">Sorted by overall average rating (highest first).</p>

        {!selectedGroup ? (
          <p className="empty-text">Select a group to view members.</p>
        ) : loadingMembers ? (
          <p className="loading-text">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="empty-text">No members found for this group.</p>
        ) : (
          <MemberTable members={members} groupName={selectedGroup} />
        )}
      </section>

      {!loadingMembers && unidentified.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Unidentified team members</h2>
            <span className="chip chip-warn">{unidentified.length} found</span>
          </div>
          <p className="section-note">
            These zIDs were entered by someone in this group but are not on the master list for this group.
          </p>
          <MemberTable members={unidentified} groupName={selectedGroup} unidentified />
        </section>
      )}
    </Layout>
  )
}
