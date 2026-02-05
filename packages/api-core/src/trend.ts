export type Trend = 'RISING' | 'FALLING' | 'FLAT';

export function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const indices = Array.from({ length: n }, (_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = indices.reduce((a, b) => a + b * b, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function classifyTrend(slope: number, epsilon: number): Trend {
  if (slope > epsilon) return 'RISING';
  if (slope < -epsilon) return 'FALLING';
  return 'FLAT';
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
