/**
 * Interface for basal analysis period
 */
interface BasalAnalysisPeriod {
  hour: number;
  values: number[];
  trend: number;
  stability: number;
  confidence: number;
  isNighttime: boolean;
  hasInsulinActivity: boolean;
}

/**
 * Enhanced basal adjustment algorithm with intelligent analysis
 */
export function computeBasalAdjustments(
  hourlyAvg: (number | null)[],
  entries: any[] = [],
  treatments: any[] = [],
  target = 100
): number[] {
  // Fallback to simple algorithm if no detailed data
  if (!entries || entries.length < 100) {
    return (hourlyAvg || Array.from({ length: 24 }, () => null)).map((avg) => {
      if (avg === null) return 0;
      const delta = avg - target;
      if (delta > 20) return Math.min(Math.round(delta / 15) * 5, 30);
      if (delta < -20) return Math.max(Math.round(delta / 15) * 5, -30);
      return 0;
    });
  }

  const periods = analyzeBasalPeriods(entries, treatments, target);

  return periods.map((period, hour) => {
    if (!period || period.values.length < 3) {
      return 0;
    }

    const avgGlucose =
      period.values.reduce((sum, v) => sum + v, 0) / period.values.length;
    const delta = avgGlucose - target;

    // Base adjustment calculation
    let adjustment = 0;
    if (Math.abs(delta) > 15) {
      // More sophisticated adjustment calculation
      if (delta > 50) {
        adjustment = Math.min(30, Math.round(delta * 0.5)); // More aggressive for high values
      } else if (delta > 30) {
        adjustment = Math.min(25, Math.round(delta * 0.4));
      } else if (delta > 15) {
        adjustment = Math.min(20, Math.round(delta * 0.6)); // Increased from 0.5
      } else if (delta < -30) {
        adjustment = Math.max(-25, Math.round(delta * 0.4));
      } else if (delta < -15) {
        adjustment = Math.max(-15, Math.round(delta * 0.5));
      }
    }

    const rawAdjustment = adjustment;

    // Apply stability factor - but less aggressively for nighttime safety
    if (period.stability < 0.7) {
      const stabilityPenalty = period.isNighttime ? 0.8 : 0.6; // Less penalty at night
      adjustment *= stabilityPenalty;
    }

    // Apply confidence factor
    adjustment *= period.confidence;

    // Night conservatism - but not for very high glucose
    let conservatismFactor = period.isNighttime ? 0.8 : 1.0; // Less conservative at night
    if (delta > 40) {
      // For very high glucose, reduce night conservatism
      conservatismFactor = Math.max(conservatismFactor, 0.9);
    }

    // Reduce adjustment if insulin activity detected, but not too much
    const activityFactor = period.hasInsulinActivity ? 0.7 : 1.0; // Less penalty

    // Apply conservatism and activity factors
    adjustment *= conservatismFactor * activityFactor;

    const finalAdjustment = Math.round(adjustment);

    return finalAdjustment;
  });
}

/**
 * Analyzes glucose entries for intelligent basal recommendations
 */
function analyzeBasalPeriods(
  entries: any[],
  treatments: any[],
  target: number
): BasalAnalysisPeriod[] {
  const periods: BasalAnalysisPeriod[] = [];

  // Group entries by hour of day
  const hourlyGroups: { [hour: number]: any[] } = {};
  entries.forEach((entry) => {
    const date = new Date(entry.dateString || entry.date);
    const hour = date.getHours();

    if (!hourlyGroups[hour]) hourlyGroups[hour] = [];
    hourlyGroups[hour].push({
      ...entry,
      timestamp: date.getTime(),
    });
  });

  // Analyze each hour
  for (let hour = 0; hour < 24; hour++) {
    const hourEntries = hourlyGroups[hour] || [];

    if (hourEntries.length < 3) {
      periods.push({
        hour,
        values: [],
        trend: 0,
        stability: 0,
        confidence: 0,
        isNighttime: hour >= 23 || hour <= 6,
        hasInsulinActivity: false,
      });
      continue;
    }

    // Filter entries without recent insulin activity
    const cleanEntries = filterInsulinActivity(hourEntries, treatments, hour);

    // Use relaxed criteria if we have some data but not enough clean data
    let finalEntries = cleanEntries;
    let hasInsulinActivity = cleanEntries.length < hourEntries.length * 0.7;

    // If very few clean entries but many total entries, use a sample of total entries
    // This is better for basal analysis than having no data at all
    if (cleanEntries.length < 3 && hourEntries.length >= 10) {
      // Take entries that are at least 2 hours after insulin
      finalEntries = hourEntries.filter((entry) => {
        const entryTime = new Date(entry.dateString || entry.date);
        const hasVeryRecentInsulin = treatments.some((treatment) => {
          if (!treatment.insulin || treatment.insulin < 0.5) return false;
          const treatmentTime = new Date(
            treatment.timestamp || treatment.created_at || treatment.date
          );
          const timeDiff = entryTime.getTime() - treatmentTime.getTime();
          return timeDiff > 0 && timeDiff < 2 * 60 * 60 * 1000; // 2h window
        });
        return !hasVeryRecentInsulin;
      });
      hasInsulinActivity = true; // Flag that this data may be influenced
    }

    if (finalEntries.length < 3) {
      periods.push({
        hour,
        values: [],
        trend: 0,
        stability: 0,
        confidence: 0,
        isNighttime: hour >= 23 || hour <= 6,
        hasInsulinActivity: true,
      });
      continue;
    }

    const values = finalEntries.map((e) => e.sgv);
    const trend = calculateTrend(values);
    const stability = calculateStability(values);
    const confidence = Math.min(1.0, finalEntries.length / 10);

    periods.push({
      hour,
      values,
      trend,
      stability,
      confidence,
      isNighttime: hour >= 23 || hour <= 6,
      hasInsulinActivity,
    });
  }

  return periods;
}

/**
 * Filters out entries that might be affected by insulin activity
 */
function filterInsulinActivity(
  entries: any[],
  treatments: any[],
  targetHour: number
): any[] {
  const filtered = entries.filter((entry) => {
    const entryTime = new Date(entry.dateString || entry.date);

    // Check if there was significant insulin within appropriate time window
    const hasRecentInsulin = treatments.some((treatment) => {
      if (!treatment.insulin || treatment.insulin < 0.5) return false;

      const treatmentTime = new Date(
        treatment.timestamp || treatment.created_at || treatment.date
      );
      const timeDiff = entryTime.getTime() - treatmentTime.getTime();

      // Dynamic window based on insulin amount and time of day
      let timeWindow;
      if (treatment.insulin < 2) {
        timeWindow = 2.5 * 60 * 60 * 1000; // 2.5h for small doses
      } else if (treatment.insulin < 4) {
        timeWindow = 3 * 60 * 60 * 1000; // 3h for medium doses
      } else {
        timeWindow = 3.5 * 60 * 60 * 1000; // 3.5h for large doses
      }

      // Night hours (22-06) get shorter windows as basal analysis is more important
      if (targetHour >= 22 || targetHour <= 6) {
        timeWindow *= 0.75;
      }

      return timeDiff > 0 && timeDiff < timeWindow;
    });

    return !hasRecentInsulin;
  });

  return filtered;
}

/**
 * Calculates trend direction (-1 to 1)
 */
function calculateTrend(values: number[]): number {
  if (values.length < 3) return 0;

  let upCount = 0;
  let downCount = 0;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 5) upCount++;
    else if (diff < -5) downCount++;
  }

  const total = upCount + downCount;
  if (total === 0) return 0;

  return (upCount - downCount) / total;
}

/**
 * Calculates stability (0 to 1, where 1 is most stable)
 */
function calculateStability(values: number[]): number {
  if (values.length < 3) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Convert to stability score (lower std dev = higher stability)
  // Normalize so that stdDev of 30 = 0.5 stability, 60 = 0 stability
  return Math.max(0, 1 - stdDev / 60);
}
