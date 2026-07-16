export function getRatingStyle(rating) {
  if (!rating) {
    return { background: '#e2e8f0', color: '#475569', label: 'No rating' }
  }

  const match = rating.match(/^(\d+)/)
  const score = match ? Number(match[1]) : null

  if (score === null) {
    return { background: '#e2e8f0', color: '#475569', label: rating }
  }

  const palette = {
    1: { background: '#fee2e2', color: '#991b1b' },
    2: { background: '#ffedd5', color: '#9a3412' },
    3: { background: '#fef3c7', color: '#92400e' },
    4: { background: '#ecfccb', color: '#3f6212' },
    5: { background: '#d1fae5', color: '#065f46' },
    6: { background: '#ccfbf1', color: '#115e59' },
    7: { background: '#dbeafe', color: '#1e40af' },
  }

  const colors = palette[score] || { background: '#e2e8f0', color: '#475569' }
  return { ...colors, label: rating }
}

export const CRITERIA = [
  { key: 'participation', label: 'Participation' },
  { key: 'dependability', label: 'Dependability' },
  { key: 'wellbeing', label: 'Team Wellbeing' },
  { key: 'work_contribution', label: 'Work Contribution' },
]
