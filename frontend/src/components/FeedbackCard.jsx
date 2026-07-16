import { CRITERIA } from '../utils/ratings'
import RatingBadge from './RatingBadge'

export default function FeedbackCard({ review, groupName, sessionId, LinkComponent }) {
  const Link = LinkComponent

  return (
    <article className="feedback-card">
      <header className="feedback-card-header">
        <div>
          <p className="feedback-label">Feedback from</p>
          {review.reviewer_name ? (
            <Link
              to={`/feedback/${encodeURIComponent(groupName)}/${review.reviewer_zid}`}
              className="member-link"
            >
              {review.reviewer_name}
            </Link>
          ) : (
            <p className="member-name">z{review.reviewer_zid}</p>
          )}
          <p className="member-meta">z{review.reviewer_zid}</p>
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
