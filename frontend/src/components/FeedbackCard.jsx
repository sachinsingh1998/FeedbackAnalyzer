import { CRITERIA } from '../utils/ratings'
import RatingBadge from './RatingBadge'

export default function FeedbackCard({ review, groupName, LinkComponent, mode = 'received' }) {
  const Link = LinkComponent
  const isGiven = mode === 'given'
  const personZid = isGiven ? review.target_zid : review.reviewer_zid
  const personName = isGiven ? review.target_name : review.reviewer_name
  const headerLabel = isGiven ? 'Feedback for' : 'Feedback from'

  return (
    <article className="feedback-card">
      <header className="feedback-card-header">
        <div>
          <p className="feedback-label">{headerLabel}</p>
          {personName ? (
            <Link
              to={`/feedback/${encodeURIComponent(groupName)}/${personZid}`}
              className="member-link"
            >
              {personName}
            </Link>
          ) : (
            <Link
              to={`/feedback/${encodeURIComponent(groupName)}/${personZid}`}
              className="member-link"
            >
              z{personZid}
            </Link>
          )}
          <p className="member-meta">z{personZid}</p>
        </div>
      </header>

      <div className="criteria-grid">
        {CRITERIA.map(({ key, label }) => {
          const criterion = review[key] || {}
          return (
            <section key={key} className="criterion-block">
              <div className="criterion-header">
                <h3>{label}</h3>
                <RatingBadge rating={criterion.rating} />
              </div>
              <p className="criterion-comment">
                {criterion.comment || 'No comment provided.'}
              </p>
            </section>
          )
        })}
      </div>
    </article>
  )
}
