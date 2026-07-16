import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchMemberFeedback } from '../api/client'
import FeedbackCard from '../components/FeedbackCard'
import Layout from '../components/Layout'

export default function FeedbackPage() {
  const { groupName, zid } = useParams()
  const navigate = useNavigate()
  const sessionId = sessionStorage.getItem('feedbackSessionId')
  const decodedGroup = decodeURIComponent(groupName)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadFeedback()
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
        <div className="panel-heading">
          <h2>Feedback Received</h2>
          {data && <span className="chip">{data.reviews.length} reviews</span>}
        </div>

        {loading ? (
          <p className="loading-text">Loading feedback…</p>
        ) : !data || data.reviews.length === 0 ? (
          <p className="empty-text">Not found — no feedback received for this member.</p>
        ) : (
          <div className="feedback-stack">
            {data.reviews.map((review, index) => (
              <FeedbackCard
                key={`${review.reviewer_zid}-${index}`}
                review={review}
                groupName={decodedGroup}
                sessionId={sessionId}
                LinkComponent={Link}
              />
            ))}
          </div>
        )}
      </section>

      {data?.submitted && data.given_reviews && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Feedback Given</h2>
            <span className="chip">{data.given_reviews.length} reviews</span>
          </div>
          <div className="feedback-stack">
            {data.given_reviews.map((review, index) => (
              <article key={`given-${review.target_zid}-${index}`} className="feedback-card compact">
                <header className="feedback-card-header">
                  <div>
                    <p className="feedback-label">Reviewed</p>
                    <Link
                      to={`/feedback/${encodeURIComponent(decodedGroup)}/${review.target_zid}`}
                      className="member-link"
                    >
                      {review.target_name || 'Not found'}
                    </Link>
                    <p className="member-meta">z{review.target_zid}</p>
                  </div>
                </header>
              </article>
            ))}
          </div>
        </section>
      )}
    </Layout>
  )
}
