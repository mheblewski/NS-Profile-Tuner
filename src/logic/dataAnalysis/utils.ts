/**
 * Converts ISO string to UTC hour (0-23)
 */
function isoToHour(iso: string): number {
  return new Date(iso).getHours();
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
