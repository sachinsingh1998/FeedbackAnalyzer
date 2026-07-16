import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchGroup, fetchGroups } from '../api/client'
import GroupSearchSelect from '../components/GroupSearchSelect'
import Layout from '../components/Layout'

export default function GroupsPage() {
  const navigate = useNavigate()
  const sessionId = sessionStorage.getItem('feedbackSessionId')
  const filename = sessionStorage.getItem('feedbackFilename')
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [members, setMembers] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }

    async function loadGroups() {
      try {
        const data = await fetchGroups(sessionId)
        setGroups(data)
        if (data.length > 0) {
          const firstReal = data.find((group) => !/^0+-*$/.test(group.name.trim()))
          setSelectedGroup((firstReal || data[0]).name)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingGroups(false)
      }
    }

    loadGroups()
  }, [sessionId, navigate])

  useEffect(() => {
    if (!sessionId || !selectedGroup) {
      return
    }

    async function loadMembers() {
      setLoadingMembers(true)
      setError('')
      try {
        const data = await fetchGroup(sessionId, selectedGroup)
        setMembers(data.members)
      } catch (err) {
        setError(err.message)
        setMembers([])
      } finally {
        setLoadingMembers(false)
      }
    }

    loadMembers()
  }, [sessionId, selectedGroup])

  return (
    <Layout
      title="Group Overview"
      subtitle={filename ? `Analyzing ${filename}` : 'Select a group to inspect member feedback.'}
      backTo="/"
      backLabel="Upload"
    >
      <section className="panel group-select-panel">
        <label className="field-label" htmlFor="group-search">
          Select group
        </label>
        <GroupSearchSelect
          groups={groups}
          value={selectedGroup}
          onChange={setSelectedGroup}
          disabled={loadingGroups || groups.length === 0}
        />
      </section>

      {error && <p className="error-banner">{error}</p>}

      <section className="panel">
        <div className="panel-heading">
          <h2>Team Members</h2>
          {!loadingMembers && (
            <span className="chip">{members.length} members</span>
          )}
        </div>

        {loadingGroups || loadingMembers ? (
          <p className="loading-text">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="empty-text">No members found for this group.</p>
        ) : (
          <div className="member-list">
            {members.map((member) => (
              <article key={member.zid} className="member-row">
                <div>
                  {member.submitted && member.name ? (
                    <Link
                      to={`/feedback/${encodeURIComponent(selectedGroup)}/${member.zid}`}
                      className="member-link"
                    >
                      {member.name}
                    </Link>
                  ) : (
                    <p className="member-name muted">Not found</p>
                  )}
                  <p className="member-meta">z{member.zid}</p>
                  {member.email && <p className="member-meta">{member.email}</p>}
                </div>
                <span className={`status-pill ${member.submitted ? 'submitted' : 'missing'}`}>
                  {member.submitted ? 'Submitted' : 'No submission'}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </Layout>
  )
}
