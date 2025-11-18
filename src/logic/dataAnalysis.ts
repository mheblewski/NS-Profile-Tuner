/**
 * Functions for analyzing Nightscout data and computing adjustments
 */

/**
 * Interface for cross-validation between basal and ICR recommendations
 */
interface ProfileValidation {
  conflicts: {
    hour: number;
    basalChange: number;
    icrChange: number;
    avgGlucose: number;
    conflictSeverity: "low" | "medium" | "high";
    recommendation: string;
  }[];
  overallCoherence: number; // 0-1, where 1 is perfectly coherent
}

/**
 * Validates that basal and ICR recommendations are coherent
 */
export function validateProfileRecommendations(
  basalAdjustments: number[],
  icrAdjustments: any[],
  entries: any[]
): ProfileValidation {
  const conflicts: any[] = [];

  // Group entries by hour to get average glucose
  const hourlyGlucose: { [hour: number]: number[] } = {};
  entries.forEach((entry) => {
    const hour = new Date(entry.dateString || entry.date).getHours();
    if (!hourlyGlucose[hour]) hourlyGlucose[hour] = [];
    hourlyGlucose[hour].push(entry.sgv);
  });

  // Check each ICR time slot against corresponding basal adjustment
  icrAdjustments.forEach((icr) => {
    const hour = icr.hour;
    const basalChange = basalAdjustments[hour] || 0;
    const icrChange =
      ((icr.suggestedICR - icr.currentICR) / icr.currentICR) * 100;

    const hourGlucose = hourlyGlucose[hour] || [];
    const avgGlucose =
      hourGlucose.length > 0
        ? hourGlucose.reduce((sum, g) => sum + g, 0) / hourGlucose.length
        : 100;

    // Detect conflicts:
    // 1. High glucose but decreasing both basal AND ICR (contradictory)
    // 2. Low glucose but increasing both basal AND ICR (contradictory)
    let conflictSeverity: "low" | "medium" | "high" = "low";
    let recommendation = "";

    if (avgGlucose > 140) {
      // High glucose should increase insulin (either basal+ or ICR-)
      if (basalChange < -5 && icrChange > 5) {
        conflictSeverity = "high";
        recommendation =
          "High glucose but both basal↓ and ICR↑ - consider prioritizing basal increase";
      } else if (basalChange < 0 && icrChange > 0) {
        conflictSeverity = "medium";
        recommendation = "Mild conflict - high glucose with mixed signals";
      }
    } else if (avgGlucose < 80) {
      // Low glucose should decrease insulin (either basal- or ICR+)
      if (basalChange > 5 && icrChange < -5) {
        conflictSeverity = "high";
        recommendation =
          "Low glucose but both basal↑ and ICR↓ - consider prioritizing basal decrease";
      } else if (basalChange > 0 && icrChange < 0) {
        conflictSeverity = "medium";
        recommendation = "Mild conflict - low glucose with mixed signals";
      }
    }

    if (
      conflictSeverity !== "low" ||
      Math.abs(basalChange) > 15 ||
      Math.abs(icrChange) > 15
    ) {
      // Don't flag large basal adjustments during typical non-meal hours as conflicts
      const isNonMealHour =
        hour >= 23 || hour <= 5 || (hour >= 14 && hour <= 16);
      const isBasalOnlyIssue =
        Math.abs(basalChange) > 15 && Math.abs(icrChange) < 5;

      if (isNonMealHour && isBasalOnlyIssue) {
        // This is probably a basal-specific issue, not a conflict
        recommendation =
          recommendation ||
          `Significant basal adjustment during non-meal period - likely appropriate`;
        conflictSeverity = "low";
      }

      conflicts.push({
        hour,
        basalChange: Math.round(basalChange),
        icrChange: Math.round(icrChange),
        avgGlucose: Math.round(avgGlucose),
        conflictSeverity,
        recommendation:
          recommendation ||
          `Large adjustments detected - basal: ${Math.round(
            basalChange
          )}%, ICR: ${Math.round(icrChange)}%`,
      });
    }
  });

  // Calculate overall coherence (fewer conflicts = higher coherence)
  const maxPossibleConflicts = icrAdjustments.length;
  const overallCoherence =
    maxPossibleConflicts > 0
      ? Math.max(0, 1 - conflicts.length / maxPossibleConflicts)
      : 1;

  return {
    conflicts,
    overallCoherence,
  };
}

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

/**
 * Interface for meal analysis with glucose outcomes
 */
export interface MealAnalysis {
  timestamp: string;
  hour: number;
  carbs: number;
  insulin: number;
  preGlucose: number | null;
  peakGlucose: number | null;
  glucoseAt2h: number | null;
  activeICR: number;
  success: boolean;
  effectiveICR: number;
}

/**
 * Interface for hourly ICR adjustment recommendations
 */
export interface HourlyICRAdjustment {
  hour: number;
  currentICR: number;
  suggestedICR: number;
  adjustmentPct: number;
  confidence: number;
  mealCount: number;
  successRate: number;
}

/**
 * Finds glucose value closest to target time
 */
function findGlucoseAt(entries: any[], targetTime: Date): number | null {
  if (!entries || entries.length === 0) return null;

  let closest = null;
  let minDiff = Infinity;

  entries.forEach((entry) => {
    const entryTime = new Date(entry.dateString || entry.sysTime || entry.date);
    const diff = Math.abs(entryTime.getTime() - targetTime.getTime());

    if (diff < minDiff && (entry.sgv || entry.glucose)) {
      minDiff = diff;
      closest = entry.sgv || entry.glucose;
    }
  });

  return minDiff < 30 * 60 * 1000 ? closest : null; // Max 30min difference
}

/**
 * Finds peak glucose within time window after meal
 */
function findPeakGlucose(
  entries: any[],
  mealTime: Date,
  windowMs: number
): number | null {
  if (!entries || entries.length === 0) return null;

  const endTime = new Date(mealTime.getTime() + windowMs);
  let peak: number | null = null;

  entries.forEach((entry) => {
    const entryTime = new Date(entry.dateString || entry.sysTime || entry.date);
    const glucose = entry.sgv || entry.glucose;

    if (entryTime >= mealTime && entryTime <= endTime && glucose) {
      if (peak === null || glucose > peak) {
        peak = glucose;
      }
    }
  });

  return peak;
}

/**
 * Expands ICR profile to 24 hours with forward fill
 */
function expandICRTo24Hours(profileICR: any[]): number[] {
  const hourlyICR = new Array(24).fill(null);

  // Map profile ICR to hours
  profileICR.forEach((icr) => {
    const [hour] = (icr.time || icr.start).split(":");
    hourlyICR[parseInt(hour)] = Number(icr.value);
  });

  // Forward-fill missing hours
  let lastValue = hourlyICR[0] || 10; // fallback
  for (let i = 0; i < 24; i++) {
    if (hourlyICR[i] === null) {
      hourlyICR[i] = lastValue;
    } else {
      lastValue = hourlyICR[i];
    }
  }

  return hourlyICR;
}

/**
 * Analyzes meals with glucose outcomes by hour
 */
function analyzeMealsWithHours(
  entries: any[],
  treatments: any[],
  hourlyICRMap: number[]
): MealAnalysis[] {
  const meals = (treatments || []).filter((t) => {
    const carbs = t.carbs || 0;
    const insulin = t.insulin || 0;

    // Include meals with:
    // 1. Any carbs > 5g (lower threshold for breakfast/snacks)
    // 2. Insulin bolus with some carbs (even if small)
    // 3. Significant insulin (>1U) with carbs, suggesting meal bolus
    return (
      carbs > 5 || (insulin > 0 && carbs > 0) || (insulin > 1 && carbs >= 0)
    );
  });

  return meals
    .map((meal) => {
      const timestamp = meal.timestamp || meal.created_at || meal.date;
      // Reduced debug - will show detailed info below

      const mealTime = new Date(timestamp);
      const hour = mealTime.getHours();
      const activeICR = hourlyICRMap[hour];

      // Analyze glucose around meal
      const preGlucose = findGlucoseAt(
        entries,
        new Date(mealTime.getTime() - 30 * 60 * 1000)
      );
      const peakGlucose = findPeakGlucose(
        entries,
        mealTime,
        3 * 60 * 60 * 1000
      );
      const glucoseAt2h = findGlucoseAt(
        entries,
        new Date(mealTime.getTime() + 2 * 60 * 60 * 1000)
      );

      const carbs = meal.carbs || 0;
      const insulin = meal.insulin || 0;
      const effectiveICR = insulin > 0 ? carbs / insulin : activeICR;

      // Define success criteria based on meal size and starting glucose
      let peakTarget = 180;
      let target2h = 140;

      // Adjust targets based on pre-meal glucose
      const preGlucoseBonus = preGlucose && preGlucose > 140 ? 20 : 0;

      // More lenient targets for smaller meals/snacks
      if (carbs <= 15) {
        peakTarget = 180 + preGlucoseBonus; // More lenient for small meals
        target2h = 140; // Keep 2h target reasonable
      } else if (carbs <= 30) {
        peakTarget = 190 + preGlucoseBonus; // Medium target for medium meals
        target2h = 150;
      } else {
        peakTarget = 200 + preGlucoseBonus; // Large meals can spike higher
        target2h = 160;
      }

      const success =
        peakGlucose !== null &&
        glucoseAt2h !== null &&
        peakGlucose < peakTarget &&
        glucoseAt2h < target2h;

      return {
        timestamp: meal.timestamp || meal.created_at || meal.date,
        hour,
        carbs,
        insulin,
        preGlucose,
        peakGlucose,
        glucoseAt2h,
        activeICR,
        effectiveICR,
        success,
      };
    })
    .filter((meal) => meal.carbs > 0); // Only keep meals with carbs
}

/**
 * Groups meal analyses by the ICR hour that applies to them
 */
function groupMealsByICRHour(
  mealAnalyses: MealAnalysis[],
  profileICR: any[]
): Record<number, MealAnalysis[]> {
  const groups: Record<number, MealAnalysis[]> = {};

  // Initialize groups for each ICR time slot
  profileICR.forEach((icrEntry) => {
    const [hourStr] = (icrEntry.time || icrEntry.start).split(":");
    const hour = parseInt(hourStr);
    groups[hour] = [];
  });

  // Map each meal to the appropriate ICR time slot
  mealAnalyses.forEach((meal) => {
    const mealHour = meal.hour;

    // Find which ICR time slot this meal belongs to
    let applicableICRHour = 0;
    for (let i = profileICR.length - 1; i >= 0; i--) {
      const [icrHourStr] = (profileICR[i].time || profileICR[i].start).split(
        ":"
      );
      const icrHour = parseInt(icrHourStr);

      if (mealHour >= icrHour) {
        applicableICRHour = icrHour;
        break;
      }
    }

    // Handle wrap-around (meal after midnight but before first ICR slot)
    if (
      mealHour <
      parseInt((profileICR[0].time || profileICR[0].start).split(":")[0])
    ) {
      const [lastHourStr] = (
        profileICR[profileICR.length - 1].time ||
        profileICR[profileICR.length - 1].start
      ).split(":");
      applicableICRHour = parseInt(lastHourStr);
    }

    if (groups[applicableICRHour]) {
      groups[applicableICRHour].push(meal);
    }
  });

  return groups;
}

/**
 * Calculates ICR adjustment for specific hour
 */
function calculateHourlyAdjustment(
  hour: number,
  currentICR: number,
  meals: MealAnalysis[]
): HourlyICRAdjustment {
  if (meals.length < 2) {
    return {
      hour,
      currentICR,
      suggestedICR: currentICR,
      adjustmentPct: 0,
      confidence: 0,
      mealCount: meals.length,
      successRate: 0,
    };
  }

  // Filter meals with valid glucose data
  const validMeals = meals.filter(
    (m) =>
      m.preGlucose !== null && m.peakGlucose !== null && m.glucoseAt2h !== null
  );

  if (validMeals.length === 0) {
    return {
      hour,
      currentICR,
      suggestedICR: currentICR,
      adjustmentPct: 0,
      confidence: 0,
      mealCount: 0,
      successRate: 0,
    };
  }

  const successRate =
    validMeals.filter((m) => m.success).length / validMeals.length;
  const avgPeakExcess =
    validMeals
      .map((m) => Math.max(0, (m.peakGlucose || 0) - 160))
      .reduce((a, b) => a + b, 0) / validMeals.length;

  const avg2hExcess =
    validMeals
      .map((m) => Math.max(0, (m.glucoseAt2h || 0) - 140))
      .reduce((a, b) => a + b, 0) / validMeals.length;

  // Calculate suggested adjustment based on outcomes
  let adjustmentPct = 0;

  if (successRate < 0.3) {
    adjustmentPct = Math.min(20, Math.max(avgPeakExcess / 8, avg2hExcess / 5));
  } else if (successRate < 0.5) {
    adjustmentPct = Math.min(15, Math.max(avgPeakExcess / 10, avg2hExcess / 7));
  } else if (successRate < 0.7) {
    adjustmentPct = Math.min(
      10,
      Math.max(avgPeakExcess / 12, avg2hExcess / 10)
    );
  } else if (avgPeakExcess > 20 || avg2hExcess > 15) {
    adjustmentPct = Math.min(5, Math.max(avgPeakExcess / 20, avg2hExcess / 15));
  }

  const suggestedICR = Number(
    (currentICR * (1 - adjustmentPct / 100)).toFixed(2)
  );
  const confidence =
    Math.min(validMeals.length / 3, 1) * (successRate > 0.1 ? 1 : 0.5);

  return {
    hour,
    currentICR,
    suggestedICR,
    adjustmentPct: Number(adjustmentPct.toFixed(1)),
    confidence: Number(confidence.toFixed(2)),
    mealCount: validMeals.length,
    successRate: Number(successRate.toFixed(2)),
  };
}

/**
 * Analyzes ICR effectiveness by hour using glucose outcomes
 */
export function analyzeHourlyICR(
  entries: any[],
  treatments: any[],
  profileICR: any[]
): HourlyICRAdjustment[] {
  if (!profileICR || profileICR.length === 0) {
    return [];
  }

  // Expand ICR profile to 24 hours
  const hourlyICRMap = expandICRTo24Hours(profileICR);

  // Analyze meals with glucose outcomes
  const mealAnalyses = analyzeMealsWithHours(entries, treatments, hourlyICRMap);

  // Group by ICR hour (not meal hour!)
  const hourlyGroups = groupMealsByICRHour(mealAnalyses, profileICR);

  // Calculate adjustments for each hour that has ICR defined
  const adjustments: HourlyICRAdjustment[] = [];

  profileICR.forEach((icrEntry) => {
    const [hourStr] = (icrEntry.time || icrEntry.start).split(":");
    const hour = parseInt(hourStr);
    const currentICR = Number(icrEntry.value);
    const mealsForHour = hourlyGroups[hour] || [];

    adjustments.push(calculateHourlyAdjustment(hour, currentICR, mealsForHour));
  });

  return adjustments.sort((a, b) => a.hour - b.hour);
}
