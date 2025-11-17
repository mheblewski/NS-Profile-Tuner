/**
 * Functions for analyzing Nightscout data and computing adjustments
 */

/**
 * Converts ISO string to UTC hour (0-23)
 */
export function isoToHour(iso: string): number {
  return new Date(iso).getUTCHours();
}

/**
 * Calculates hourly average glucose values from entries
 */
export function hourlyAverage(entriesArray: any[]): (number | null)[] {
  const buckets = Array.from({ length: 24 }, () => [] as number[]);

  (entriesArray || []).forEach((e) => {
    const bg = e.sgv || e.glucose;
    if (bg == null) return;

    const iso =
      e.dateString ||
      e.sysTime ||
      (e.date ? new Date(e.date).toISOString() : new Date().toISOString());
    const hour = isoToHour(iso);
    buckets[hour].push(Number(bg));
  });

  return buckets.map((arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  );
}

/**
 * Computes basal adjustment percentages based on hourly averages
 */
export function computeBasalAdjustments(
  hourlyAvg: (number | null)[],
  target = 100
): number[] {
  return (hourlyAvg || Array.from({ length: 24 }, () => null)).map((avg) => {
    if (avg === null) return 0;
    const delta = avg - target;
    if (delta > 20) return Math.min(Math.round(delta / 15) * 5, 30);
    if (delta < -20) return Math.max(Math.round(delta / 15) * 5, -30);
    return 0;
  });
}

/**
 * Analyzes treatments to determine ICR and ISF adjustment percentages
 */
export function analyzeTreatments(treatments: any[]): {
  icrPct: number;
  isfPct: number;
} {
  const boluses = (treatments || []).filter((t) => t.insulin || t.carbs);
  let largeSpikes = 0;
  let strongCorr = 0;

  boluses.forEach((b) => {
    if ((b.carbs || 0) > 30) largeSpikes++;
    if ((b.insulin || 0) >= 2.5 && !b.carbs) strongCorr++;
  });

  let icrPct = 0;
  if (largeSpikes >= 3 && largeSpikes < 5) {
    icrPct = 10;
  } else if (largeSpikes >= 5) {
    icrPct = 15;
  }

  const isfPct = strongCorr > 1 ? 15 : 0;

  return { icrPct, isfPct };
}
