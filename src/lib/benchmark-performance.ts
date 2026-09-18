export interface BenchmarkPoint {
  date: string;
  price: number;
}

export interface BenchmarkPerformance {
  returnPercent: number;
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
}

export function getBenchmarkPerformance(
  points: BenchmarkPoint[],
  startDate: string | null | undefined,
  endDate: string | null | undefined
): BenchmarkPerformance | null {
  if (!startDate || !endDate || startDate > endDate) return null;

  const validPoints = points
    .filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
        Number.isFinite(point.price) &&
        point.price > 0 &&
        point.date <= endDate
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!validPoints.length) return null;

  const pointBeforeOrOnStart = validPoints.filter((point) => point.date <= startDate).at(-1);
  const firstPointInRange = validPoints.find((point) => point.date >= startDate);
  const first = pointBeforeOrOnStart || firstPointInRange;
  const latest = validPoints.at(-1);

  if (!first || !latest || first.date >= latest.date) return null;

  const returnPercent = ((latest.price - first.price) / first.price) * 100;
  if (!Number.isFinite(returnPercent)) return null;

  return {
    returnPercent,
    startDate: first.date,
    endDate: latest.date,
    startPrice: first.price,
    endPrice: latest.price,
  };
}
