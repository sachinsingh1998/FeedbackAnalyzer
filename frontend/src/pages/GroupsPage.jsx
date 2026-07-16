import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchGroup, fetchGroups } from '../api/client'
import GroupSearchSelect from '../components/GroupSearchSelect'
import Layout from '../components/Layout'

function MemberRow({ member, groupName, unidentified = false }) {
  const displayName = member.name || (unidentified ? `z${member.zid}` : 'Not found')
  const canLink = Boolean(member.name) || unidentified

  return (
    <article className="member-row">
      <div>
        {canLink ? (
          <Link
            to={`/feedback/${encodeURIComponent(groupName)}/${member.zid}`}
            className="member-link"
          >
            {displayName}
          </Link>
        ) : (
          <p className="member-name muted">Not found</p>
        )}
        <p className="member-meta">z{member.zid}</p>
        {member.email && <p className="member-meta">{member.email}</p>}
        {unidentified && member.noted_by?.length > 0 && (
          <p className="member-meta">
            Entered by {member.noted_by.length} teammate
            {member.noted_by.length === 1 ? '' : 's'}
          </p>
        )}
      </div>
      {unidentified ? (
        <span className="status-pill missing">Unidentified</span>
      ) : (
        <span className={`status-pill ${member.submitted ? 'submitted' : 'missing'}`}>
          {member.submitted ? 'Submitted' : 'No submission'}
        </span>
      )}
    </article>
  )
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const sessionId = sessionStorage.getItem('feedbackSessionId')
  const filename = sessionStorage.getItem('feedbackFilename')
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [members, setMembers] = useState([])
  const [unidentified, setUnidentified] = useState([])
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
          setSelectedGroup(data[0].name)
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
        setUnidentified(data.unidentified_members || [])
      } catch (err) {
        setError(err.message)
        setMembers([])
        setUnidentified([])
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
              <MemberRow key={member.zid} member={member} groupName={selectedGroup} />
            ))}
          </div>
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
          <div className="member-list">
            {unidentified.map((member) => (
              <MemberRow
                key={member.zid}
                member={member}
                groupName={selectedGroup}
                unidentified
              />
            ))}
          </div>
        </section>
      )}
    </Layout>
  )
}
