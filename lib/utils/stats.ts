/**
 * Calculate Gini coefficient for a distribution
 * @param values Array of values (PR counts)
 * @returns Gini coefficient (0 = perfect equality, 1 = perfect inequality)
 */
export function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;

  // Sort values (KEEP zeros - they represent inequality!)
  const sorted = [...values].sort((a, b) => a - b);

  // If everyone has zero PRs, that's actually perfect equality
  const total = sorted.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;

  const n = sorted.length;
  let numerator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }

  const denominator = n * total;
  return numerator / denominator;
}

/**
 * Calculate team balance score (inverted Gini)
 * @param values Array of PR counts per person
 * @returns Balance score (0 = worst, 1 = best)
 */
export function calculateTeamBalanceScore(values: number[]): number {
  const gini = calculateGiniCoefficient(values);
  return 1 - gini;
}

/**
 * Calculate normalized entropy for a distribution
 * @param values Array of PR counts per person
 * @returns Normalized entropy (0 = complete concentration, 1 = perfect equality)
 */
export function calculateNormalizedEntropy(values: number[]): number {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 1; // No PRs = perfectly balanced (edge case)

  // Calculate entropy
  const probabilities = values.map(v => v / total).filter(p => p > 0);
  if (probabilities.length === 0) return 1;

  const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);

  // Normalize by max possible entropy
  const maxEntropy = Math.log2(values.length);

  return maxEntropy === 0 ? 1 : entropy / maxEntropy;
}
