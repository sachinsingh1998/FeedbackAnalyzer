import { getRatingStyle } from '../utils/ratings'

export default function RatingBadge({ rating }) {
  const style = getRatingStyle(rating)
  return (
    <span
      className="rating-badge"
      style={{ backgroundColor: style.background, color: style.color }}
    >
      {style.label}
    </span>
  )
}
