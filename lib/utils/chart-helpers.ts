export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

/**
 * Generate a CSS-safe key from a name by replacing non-alphanumeric characters
 */
export function createSafeChartKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}
