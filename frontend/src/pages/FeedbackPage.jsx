import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchMemberFeedback } from '../api/client'
import FeedbackCard from '../components/FeedbackCard'
import Layout from '../components/Layout'
import { clearFeedbackSession, isSessionExpiredError } from '../utils/session'

export default function FeedbackPage() {
  const { groupName, zid } = useParams()
  const navigate = useNavigate()
  const sessionId = sessionStorage.getItem('feedbackSessionId')
  const decodedGroup = decodeURIComponent(groupName)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('received')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }

    async function loadFeedback() {
      setLoading(true)
      setError('')
      try {
        const result = await fetchMemberFeedback(sessionId, decodedGroup, zid)
        setData(result)
      } catch (err) {
        if (isSessionExpiredError(err.message)) {
          clearFeedbackSession()
          navigate('/', { replace: true })
          return
        }
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadFeedback()
    setActiveTab('received')
  }, [sessionId, decodedGroup, zid, navigate])

  const displayName = data?.name || 'Not found'
  const hasDetails = Boolean(data?.name)
  const subtitle = data?.unidentified
    ? `Group ${decodedGroup} · Unidentified zID · Feedback received`
    : `Group ${decodedGroup} · Feedback received`

  return (
    <Layout
      title={hasDetails ? displayName : `Member z${zid}`}
      subtitle={subtitle}
      backTo="/groups"
      backLabel="Groups"
    >
      <section className="panel member-summary">
        <div className="summary-grid">
          <div>
            <p className="summary-label">Name</p>
            <p className="summary-value">{hasDetails ? data.name : 'Not found'}</p>
          </div>
          <div>
            <p className="summary-label">zID</p>
            <p className="summary-value">z{zid}</p>
          </div>
          <div>
            <p className="summary-label">Email</p>
            <p className="summary-value">{data?.email || 'Not found'}</p>
          </div>
          <div>
            <p className="summary-label">Status</p>
            <p className="summary-value">
              {data?.unidentified
                ? 'Unidentified'
                : data?.submitted
                  ? 'Submitted'
                  : 'No submission'}
            </p>
          </div>
        </div>
      </section>

      {error && <p className="error-banner">{error}</p>}

      <section className="panel">
        <div className="tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'received'}
            className={`tab-button ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Feedback Received
            {data && <span className="tab-count">{data.reviews.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'given'}
            className={`tab-button ${activeTab === 'given' ? 'active' : ''}`}
            onClick={() => setActiveTab('given')}
          >
            Feedback Given
            {data?.given_reviews && (
              <span className="tab-count">{data.given_reviews.length}</span>
            )}
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading feedback…</p>
        ) : activeTab === 'received' ? (
          !data || data.reviews.length === 0 ? (
            <p className="empty-text">Not found — no feedback received for this member.</p>
          ) : (
            <div className="feedback-stack">
              {data.reviews.map((review, index) => (
                <FeedbackCard
                  key={`${review.reviewer_zid}-${index}`}
                  review={review}
                  groupName={decodedGroup}
                  LinkComponent={Link}
                />
              ))}
            </div>
          )
        ) : !data?.submitted || !data.given_reviews || data.given_reviews.length === 0 ? (
          <p className="empty-text">
            {data?.submitted
              ? 'No feedback given by this member.'
              : 'Not found — this member did not submit the peer evaluation form.'}
          </p>
        ) : (
          <div className="feedback-stack">
            {data.given_reviews.map((review, index) => (
              <FeedbackCard
                key={`given-${review.target_zid}-${index}`}
                review={review}
                groupName={decodedGroup}
                LinkComponent={Link}
                mode="given"
              />
            ))}
          </div>
        )}
      </section>
    </Layout>
  )
}
