// Scores are probabilities in [0, 1]; confidence is independent of the predicted class.
export function confidenceLevel(score) {
  if (score === null || score === undefined || score === '') return 'unknown';
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 1) return 'unknown';
  return value >= 0.7 ? 'high' : value >= 0.4 ? 'mid' : 'low';
}