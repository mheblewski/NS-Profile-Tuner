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
 * Interface for ISF (correction bolus) analysis
 */
export interface ISFAnalysis {
  timestamp: string;
  hour: number;
  correctionInsulin: number;
  preGlucose: number;
  targetGlucose: number; // Expected target (usually 100-120)
  glucoseAt2h: number | null;
  glucoseAt3h: number | null;
  actualDrop: number | null; // Actual glucose drop
  expectedDrop: number; // Expected drop based on current ISF
  efficiency: number | null; // Actual/Expected ratio
  success: boolean;
  currentISF: number; // ISF value that was used
}

/**
 * Interface for hourly ISF adjustment
 */
export interface HourlyISFAdjustment {
  hour: number;
  currentISF: number;
  suggestedISF: number;
  adjustmentPct: number;
  confidence: number; // 0-1, based on data quality and quantity
  correctionCount: number;
  avgEfficiency: number; // Average efficiency of corrections
  successRate: number;
  isNewSlot?: boolean; // True if this is a newly suggested time slot
  isGroupedRecommendation?: boolean; // True if this represents multiple grouped hours
  affectedHours?: number[]; // List of hours affected by this recommendation
  isProfileCompliant?: boolean; // True if current ISF is already good (small change needed)
}

/**
 * Enhanced ISF analysis based on correction bolus outcomes
 */
export function analyzeHourlyISF(
  entries: any[],
  treatments: any[],
  profileISF: any[]
): {
  modifications: HourlyISFAdjustment[];
  newSlots: HourlyISFAdjustment[];
  profileCompliant: HourlyISFAdjustment[];
} {
  console.log("🔍 ISF Analysis - FULL DEBUG MODE");
  console.log(
    `📊 Processing ${entries.length} entries and ${treatments.length} treatments`
  );

  // Safety check for profile ISF
  if (!profileISF || profileISF.length === 0) {
    console.log("❌ No ISF profile provided");
    return { modifications: [], newSlots: [], profileCompliant: [] };
  }

  // Validate ISF profile structure
  const validISFSlots = profileISF.filter(
    (slot) => slot && (slot.time || slot.start) && slot.value !== undefined
  );

  if (validISFSlots.length === 0) {
    console.log("❌ No valid ISF slots found");
    return { modifications: [], newSlots: [], profileCompliant: [] };
  }

  console.log("📋 Original ISF Profile:");
  validISFSlots.forEach((slot, i) => {
    console.log(`  ${i}: ${slot.time || slot.start} = ${slot.value} mg/dL/U`);
  });

  // Create hourly ISF map
  const hourlyISFMap: number[] = new Array(24).fill(
    validISFSlots[0].value || 30
  );

  validISFSlots.forEach((isfSlot) => {
    if (isfSlot.time || isfSlot.start) {
      const startHour = parseInt((isfSlot.time || isfSlot.start).split(":")[0]);
      for (let h = startHour; h < 24; h++) {
        hourlyISFMap[h] = isfSlot.value;
      }
    }
  });

  // Analyze both correction boluses AND temp basal corrections
  const correctionAnalyses = analyzeCorrectionBoluses(
    entries,
    treatments,
    hourlyISFMap
  );
  const tempBasalAnalyses = analyzeTempBasalCorrections(
    entries,
    treatments,
    hourlyISFMap
  );

  // Combine both types of analysis
  const allCorrections = [...correctionAnalyses, ...tempBasalAnalyses];

  console.log(`🔬 Analysis Results:`);
  console.log(`  📝 ${correctionAnalyses.length} correction boluses`);
  console.log(`  🔄 ${tempBasalAnalyses.length} temp basal corrections`);
  console.log(`  📊 ${allCorrections.length} total corrections`);

  const cleanCorrections = allCorrections.filter((c: any) => !c.nearbyMeal);
  const mealContaminated = allCorrections.length - cleanCorrections.length;

  console.log(`  ✅ ${cleanCorrections.length} clean corrections`);
  console.log(`  🍽️ ${mealContaminated} meal-contaminated`);

  // NEW: Analyze ALL 24 hours, not just existing profile slots
  return analyzeAllHoursForISF(allCorrections, hourlyISFMap, validISFSlots);
}

/**
 * Analyzes temp basal corrections as alternative to correction boluses in closed loop systems
 */
function analyzeTempBasalCorrections(
  entries: any[],
  treatments: any[],
  hourlyISFMap: number[]
): ISFAnalysis[] {
  // Find temp basal treatments that are significantly above profile
  const tempBasals = treatments
    .filter((t) => t.eventType === "Temp Basal")
    .filter((t) => t.rate && parseFloat(t.rate) > 0)
    .map((t) => ({
      ...t,
      timestamp: new Date(t.timestamp || t.created_at || t.mills),
      rate: parseFloat(t.rate),
      duration: parseInt(t.duration) || 30, // minutes
    }))
    .filter((t) => t.timestamp && !isNaN(t.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Find periods of elevated temp basals (compared to typical basal rates)
  const correctionBasals = tempBasals.filter((tb) => {
    // For low-insulin users, even small increases can be corrective
    // Look for rates >50% above average OR >0.6 U/h (absolute threshold)
    const avgRate =
      tempBasals.reduce((sum, t) => sum + t.rate, 0) / tempBasals.length;
    const threshold = Math.max(avgRate * 1.5, 0.6); // Adaptive threshold
    return tb.rate > threshold;
  });

  // Calculate baseline basal rate for correction insulin calculation
  const avgRate =
    tempBasals.reduce((sum, t) => sum + t.rate, 0) / tempBasals.length;
  const baselineRate = avgRate * 0.8; // Use 80% of average as "normal" basal

  return correctionBasals
    .map((tempBasal) => {
      const correctionTime = tempBasal.timestamp;
      const hour = correctionTime.getHours();

      // Find glucose at temp basal start
      const preGlucose = findNearestGlucose(entries, correctionTime, -30, 0);
      if (!preGlucose || preGlucose < 120) {
        return null; // Skip if no high glucose to correct
      }

      // Calculate "correction insulin" equivalent using dynamic baseline
      const basalIncrease = Math.max(0, tempBasal.rate - baselineRate);
      const durationHours = tempBasal.duration / 60;
      const correctionInsulin = basalIncrease * durationHours;

      if (correctionInsulin < 0.05) {
        // Lower threshold for low-insulin users
        return null; // Too small to analyze
      }

      // Check for nearby meals
      const nearbyMeal = treatments.some((t) => {
        if ((t.carbs || 0) >= 5) {
          const mealTime = new Date(t.timestamp || t.created_at || t.date);
          const timeDiff = Math.abs(
            mealTime.getTime() - correctionTime.getTime()
          );
          return timeDiff < 120 * 60 * 1000; // 2 hours for temp basals
        }
        return false;
      });

      // Target glucose for correction
      const targetGlucose = 100; // Standard target

      // Get glucose response
      const glucoseAt2h = findNearestGlucose(entries, correctionTime, 110, 130);
      const glucoseAt3h = findNearestGlucose(entries, correctionTime, 170, 190);

      if (!glucoseAt2h && !glucoseAt3h) {
        return null; // No follow-up data
      }

      // Use 3h if 2h not available (temp basals work slower)
      const finalGlucose = glucoseAt2h || glucoseAt3h;
      if (!finalGlucose) {
        return null; // No follow-up glucose data
      }

      const actualDrop = preGlucose - finalGlucose;

      // Calculate efficiency
      const currentISF = hourlyISFMap[hour];
      const expectedDrop = correctionInsulin * currentISF;
      const efficiency = expectedDrop > 0 ? actualDrop / expectedDrop : 0;

      // Success criteria (more lenient for temp basals)
      const success =
        actualDrop > 20 && efficiency > 0.5 && finalGlucose < preGlucose * 0.9;

      return {
        timestamp: correctionTime,
        hour,
        correctionInsulin: correctionInsulin,
        preGlucose,
        targetGlucose,
        glucoseAt2h,
        glucoseAt3h,
        actualDrop,
        expectedDrop,
        efficiency,
        success,
        currentISF,
        nearbyMeal,
      };
    })
    .filter((analysis) => analysis !== null) as ISFAnalysis[];
}

/**
 * Analyzes correction bolus effectiveness
 */
function analyzeCorrectionBoluses(
  entries: any[],
  treatments: any[],
  hourlyISFMap: number[]
): ISFAnalysis[] {
  const corrections = (treatments || []).filter((t) => {
    const insulin = t.insulin || 0;
    const carbs = t.carbs || 0;
    // Much stricter: correction bolus without carbs AND reasonable size
    // Large "corrections" (>1.5U) are often missed meal boluses
    return insulin > 0.3 && insulin < 1.5 && carbs === 0; // No carbs, small corrections only
  });

  return corrections
    .map((correction) => {
      const timestamp =
        correction.timestamp || correction.created_at || correction.date;
      if (!timestamp) return null;

      const correctionTime = new Date(timestamp);
      const hour = correctionTime.getHours();
      const currentISF = hourlyISFMap[hour];

      // Check if there's a meal nearby (within 30 minutes before or after)
      const nearbyMeal = treatments.some((t) => {
        if ((t.carbs || 0) >= 5) {
          const mealTime = new Date(t.timestamp || t.created_at || t.date);
          const timeDiff = Math.abs(
            mealTime.getTime() - correctionTime.getTime()
          );
          return timeDiff < 30 * 60 * 1000; // 30 minutes
        }
        return false;
      });

      // Find glucose before correction (within 30 min before)
      const preGlucose = findNearestGlucose(entries, correctionTime, -30, 0);

      // CORRECTION SHOULD BE FOR HIGH GLUCOSE - skip if glucose was normal/low
      if (!preGlucose || preGlucose < 150) {
        return null; // True corrections happen when glucose is high
      }

      // Find glucose 2-3 hours after correction
      const glucoseAt2h = findNearestGlucose(entries, correctionTime, 110, 130); // 2h ±10min
      const glucoseAt3h = findNearestGlucose(entries, correctionTime, 170, 190); // 3h ±10min

      const correctionInsulin = correction.insulin || 0;
      const targetGlucose = 110; // Standard target
      const expectedDrop = correctionInsulin * currentISF;

      // Calculate actual drop and efficiency
      let actualDrop: number | null = null;
      let efficiency: number | null = null;
      let finalGlucose: number | null = null;

      // Prefer 2h glucose, fall back to 3h
      if (glucoseAt2h !== null) {
        finalGlucose = glucoseAt2h;
        actualDrop = preGlucose - glucoseAt2h;
      } else if (glucoseAt3h !== null) {
        finalGlucose = glucoseAt3h;
        actualDrop = preGlucose - glucoseAt3h;
      }

      if (actualDrop !== null && expectedDrop > 0) {
        efficiency = actualDrop / expectedDrop;
      }

      // Additional filtering: if "correction" has very low efficiency,
      // it might be a missed meal bolus
      if (efficiency !== null && efficiency < 0.1 && correctionInsulin > 1.0) {
        return null;
      }

      // Determine success: for high ISF (pediatric), expect smaller drops
      // Success = meaningful glucose reduction without going too low
      const minDrop = Math.min(expectedDrop * 0.3, 30); // At least 30% of expected or 30mg/dL
      const reasonableEfficiency =
        efficiency !== null && efficiency > 0.2 && efficiency < 3.0;
      const success =
        finalGlucose !== null &&
        finalGlucose >= 70 &&
        finalGlucose < preGlucose && // Glucose went down
        (actualDrop || 0) > minDrop && // Meaningful drop
        reasonableEfficiency && // Reasonable efficiency range
        !nearbyMeal; // Exclude corrections near meals

      return {
        timestamp,
        hour,
        correctionInsulin,
        preGlucose,
        targetGlucose,
        glucoseAt2h,
        glucoseAt3h,
        actualDrop,
        expectedDrop,
        efficiency,
        success,
        currentISF,
        nearbyMeal, // Add this for debugging
      };
    })
    .filter((analysis) => analysis !== null) as ISFAnalysis[];
}

/**
 * Groups corrections by ISF time slots
 */
function groupCorrectionsByISFHour(
  correctionAnalyses: ISFAnalysis[],
  profileISF: any[]
): { [hour: number]: ISFAnalysis[] } {
  const groups: { [hour: number]: ISFAnalysis[] } = {};

  // Initialize groups for each ISF time slot
  profileISF.forEach((isfSlot) => {
    const hour = parseInt((isfSlot.time || isfSlot.start).split(":")[0]);
    groups[hour] = [];
  });

  // Map each correction to the appropriate ISF time slot
  correctionAnalyses.forEach((correction) => {
    const correctionHour = correction.hour;

    // Find which ISF time slot this correction belongs to
    let applicableISFHour = 0;
    for (let i = profileISF.length - 1; i >= 0; i--) {
      const isfSlot = profileISF[i];
      if (!isfSlot || (!isfSlot.time && !isfSlot.start)) continue;

      const [isfHourStr] = (isfSlot.time || isfSlot.start).split(":");
      const isfHour = parseInt(isfHourStr);

      if (correctionHour >= isfHour) {
        applicableISFHour = isfHour;
        break;
      }
    }

    // Handle wrap-around (correction after midnight but before first ISF slot)
    const firstSlot = profileISF[0];
    const lastSlot = profileISF[profileISF.length - 1];

    if (
      firstSlot &&
      (firstSlot.time || firstSlot.start) &&
      correctionHour <
        parseInt((firstSlot.time || firstSlot.start).split(":")[0])
    ) {
      if (lastSlot && (lastSlot.time || lastSlot.start)) {
        const [lastHourStr] = (lastSlot.time || lastSlot.start).split(":");
        applicableISFHour = parseInt(lastHourStr);
      }
    }

    if (groups[applicableISFHour]) {
      groups[applicableISFHour].push(correction);
    }
  });

  return groups;
}

/**
 * Calculates ISF adjustment for specific hour
 */
function calculateHourlyISFAdjustment(
  hour: number,
  currentISF: number,
  corrections: ISFAnalysis[]
): HourlyISFAdjustment {
  if (corrections.length < 2) {
    return {
      hour,
      currentISF,
      suggestedISF: currentISF,
      adjustmentPct: 0,
      confidence: 0,
      correctionCount: corrections.length,
      avgEfficiency: 0,
      successRate: 0,
    };
  }

  // Filter corrections with complete data
  const validCorrections = corrections.filter((c) => c.efficiency !== null);

  if (validCorrections.length === 0) {
    return {
      hour,
      currentISF,
      suggestedISF: currentISF,
      adjustmentPct: 0,
      confidence: 0,
      correctionCount: 0,
      avgEfficiency: 0,
      successRate: 0,
    };
  }

  const successRate =
    validCorrections.filter((c) => c.success).length / validCorrections.length;
  const avgEfficiency =
    validCorrections.reduce((sum, c) => sum + (c.efficiency || 0), 0) /
    validCorrections.length;

  // Calculate suggested ISF based on average efficiency
  let suggestedISF = currentISF;
  let adjustmentPct = 0;

  if (avgEfficiency > 0) {
    // If efficiency > 1, ISF is too low (insulin too strong), increase ISF
    // If efficiency < 1, ISF is too high (insulin too weak), decrease ISF
    const targetEfficiency = 0.9; // Aim for 90% efficiency (slight overcorrection prevention)
    const efficiencyRatio = targetEfficiency / avgEfficiency;

    // Calculate new ISF
    suggestedISF = Math.max(10, Math.min(100, currentISF * efficiencyRatio));
    adjustmentPct = ((suggestedISF - currentISF) / currentISF) * 100;

    // Limit adjustments to safe ranges
    adjustmentPct = Math.max(-30, Math.min(30, adjustmentPct));
    suggestedISF = currentISF * (1 + adjustmentPct / 100);
  }

  const confidence = Math.min(1.0, validCorrections.length / 5); // Full confidence with 5+ corrections

  return {
    hour,
    currentISF,
    suggestedISF: Math.round(suggestedISF * 10) / 10, // Round to 0.1
    adjustmentPct: Math.round(adjustmentPct),
    confidence,
    correctionCount: validCorrections.length,
    avgEfficiency: Math.round(avgEfficiency * 100) / 100,
    successRate: Math.round(successRate * 100) / 100,
  };
}

/**
 * Analyzes treatments to determine ICR and ISF adjustment percentages (legacy function)
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
 * Finds glucose value within a specific time window (in minutes)
 */
function findNearestGlucose(
  entries: any[],
  baseTime: Date,
  startMinutes: number,
  endMinutes: number
): number | null {
  if (!entries || entries.length === 0) return null;

  const startTime = new Date(baseTime.getTime() + startMinutes * 60 * 1000);
  const endTime = new Date(baseTime.getTime() + endMinutes * 60 * 1000);

  let closest = null;
  let minDiff = Infinity;

  entries.forEach((entry) => {
    const entryTime = new Date(entry.dateString || entry.sysTime || entry.date);

    // Check if entry is within time window
    if (entryTime >= startTime && entryTime <= endTime) {
      const diff = Math.abs(entryTime.getTime() - baseTime.getTime());

      if (diff < minDiff && (entry.sgv || entry.glucose)) {
        minDiff = diff;
        closest = entry.sgv || entry.glucose;
      }
    }
  });

  return closest;
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

/**
 * Analyzes ALL 24 hours for ISF optimization, detecting new time slots needed
 */
function analyzeAllHoursForISF(
  allCorrections: ISFAnalysis[],
  hourlyISFMap: number[],
  existingSlots: any[]
): {
  modifications: HourlyISFAdjustment[];
  newSlots: HourlyISFAdjustment[];
  profileCompliant: HourlyISFAdjustment[];
} {
  console.log("🕐 Analyzing ALL 24 hours for ISF optimization...");

  // Group corrections by actual hour they occurred
  const correctionsByHour: { [hour: number]: ISFAnalysis[] } = {};

  // Initialize all 24 hours
  for (let h = 0; h < 24; h++) {
    correctionsByHour[h] = [];
  }

  // Group corrections by hour
  allCorrections.forEach((correction) => {
    const hour = correction.hour;
    correctionsByHour[hour].push(correction);
  });

  console.log("📈 Corrections by hour:");
  for (let h = 0; h < 24; h++) {
    if (correctionsByHour[h].length > 0) {
      console.log(
        `  ${h.toString().padStart(2, "0")}:00 - ${
          correctionsByHour[h].length
        } corrections`
      );
    }
  }

  const results: HourlyISFAdjustment[] = [];
  const existingSlotHours = existingSlots.map((slot) =>
    parseInt((slot.time || slot.start).split(":")[0])
  );

  console.log("🎯 Existing ISF slots at hours:", existingSlotHours);

  // Analyze each hour
  for (let hour = 0; hour < 24; hour++) {
    const corrections = correctionsByHour[hour].filter(
      (c: any) => !c.nearbyMeal
    );

    if (corrections.length === 0) continue; // Skip hours with no data

    const currentISF = hourlyISFMap[hour];
    console.log(`\n🔍 Hour ${hour.toString().padStart(2, "0")}:00 analysis:`);
    console.log(`  📊 ${corrections.length} clean corrections available`);
    console.log(`  🎚️ Current ISF: ${currentISF} mg/dL/U`);

    const adjustment = calculateHourlyISFAdjustment(
      hour,
      currentISF,
      corrections
    );

    console.log(`  ➡️ Suggested ISF: ${adjustment.suggestedISF} mg/dL/U`);
    console.log(`  📈 Adjustment: ${adjustment.adjustmentPct}%`);
    console.log(`  🎯 Confidence: ${adjustment.confidence}`);

    // Mark if this is a new suggested slot (not in existing profile)
    const isNewSlot = !existingSlotHours.includes(hour);
    const isSignificantChange = Math.abs(adjustment.adjustmentPct) >= 10; // 10%+ change

    console.log(`  🆕 New slot: ${isNewSlot}`);
    console.log(`  ⚡ Significant change: ${isSignificantChange}`);

    // Include in results if:
    // 1. Existing slot with any change
    // 2. New slot with significant change needed
    // 3. Existing slot with small change (mark as "profile compliant")

    const isProfileCompliant =
      !isNewSlot && !isSignificantChange && corrections.length >= 2;

    if (
      !isNewSlot ||
      (isNewSlot && isSignificantChange && corrections.length >= 2) ||
      isProfileCompliant
    ) {
      console.log(
        `  ✅ INCLUDED in results ${
          isProfileCompliant ? "(profile compliant)" : ""
        }`
      );
      results.push({
        ...adjustment,
        isNewSlot: isNewSlot,
        isProfileCompliant: isProfileCompliant,
      });
    } else {
      console.log(`  ❌ EXCLUDED from results`);
    }
  }

  console.log(`\n🎯 Raw results: ${results.length} ISF recommendations`);

  // NEW: Intelligent grouping and split into modifications vs new slots
  const optimizedResults = optimizeISFTimeSlots(results, existingSlots);
  console.log(
    `🧠 After intelligent grouping: ${optimizedResults.modifications.length} modifications + ${optimizedResults.newSlots.length} new slots`
  );

  return optimizedResults;
}

/**
 * Optimizes ISF time slots by grouping similar adjacent recommendations
 * Returns separate arrays for modifications and new slots
 */
function optimizeISFTimeSlots(
  results: HourlyISFAdjustment[],
  existingSlots: any[]
): {
  modifications: HourlyISFAdjustment[];
  newSlots: HourlyISFAdjustment[];
  profileCompliant: HourlyISFAdjustment[];
} {
  if (results.length === 0)
    return { modifications: [], newSlots: [], profileCompliant: [] };

  console.log(
    "🧠 Creating complete profile view with separate modifications..."
  );

  const modifications: HourlyISFAdjustment[] = [];
  const newSlots: HourlyISFAdjustment[] = [];
  const profileCompliant: HourlyISFAdjustment[] = [];

  // Extract profile compliant entries
  const needsOptimization = results.filter((r) => !r.isProfileCompliant);
  const compliantEntries = results.filter((r) => r.isProfileCompliant);

  console.log(`🟢 ${compliantEntries.length} profile compliant entries found`);
  profileCompliant.push(...compliantEntries);

  // NEW APPROACH: Show each existing profile slot separately
  // Create a mapping of which problems affect which existing slots
  const existingSlotHours = existingSlots.map((slot) =>
    parseInt((slot.time || slot.start).split(":")[0])
  );

  console.log(`📋 Existing profile slots at: ${existingSlotHours.join(", ")}`);

  // For each existing slot, determine if it needs changes based on analysis results
  existingSlots.forEach((slot) => {
    const slotHour = parseInt((slot.time || slot.start).split(":")[0]);
    const currentISF = slot.value;

    // Find analysis results that would be covered by this slot
    // (problems that occur after this slot time but before next slot)
    const nextSlotHour =
      existingSlots
        .map((s) => parseInt((s.time || s.start).split(":")[0]))
        .filter((h) => h > slotHour)
        .sort((a, b) => a - b)[0] || 24; // Next slot or end of day

    // Find problems in the range covered by this slot
    const problemsInRange = needsOptimization.filter((problem) => {
      return problem.hour >= slotHour && problem.hour < nextSlotHour;
    });

    console.log(
      `🔍 Slot ${slotHour}:00 (${currentISF}) covers hours ${slotHour}-${nextSlotHour}, problems: [${problemsInRange
        .map((p) => p.hour)
        .join(", ")}]`
    );

    if (problemsInRange.length > 0) {
      // This slot needs modification - use the most confident suggestion
      const bestProblem = problemsInRange.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      modifications.push({
        hour: slotHour,
        currentISF: currentISF,
        suggestedISF: bestProblem.suggestedISF,
        adjustmentPct: Math.round(
          ((bestProblem.suggestedISF - currentISF) / currentISF) * 100
        ),
        confidence: bestProblem.confidence,
        correctionCount: problemsInRange.reduce(
          (sum, p) => sum + p.correctionCount,
          0
        ),
        avgEfficiency:
          problemsInRange.reduce((sum, p) => sum + p.avgEfficiency, 0) /
          problemsInRange.length,
        successRate:
          problemsInRange.reduce((sum, p) => sum + p.successRate, 0) /
          problemsInRange.length,
        isNewSlot: false,
        isGroupedRecommendation: problemsInRange.length > 1,
        affectedHours: problemsInRange.map((p) => p.hour),
      });
    } else {
      // This slot is fine as is
      profileCompliant.push({
        hour: slotHour,
        currentISF: currentISF,
        suggestedISF: currentISF,
        adjustmentPct: 0,
        confidence: 1.0,
        correctionCount: 0,
        avgEfficiency: 1.0,
        successRate: 1.0,
        isNewSlot: false,
        isProfileCompliant: true,
      });
    }
  });

  // Add truly new slots (hours not covered by any existing slot)
  const trulyNewProblems = needsOptimization.filter((problem) => {
    return !existingSlots.some((slot) => {
      const slotHour = parseInt((slot.time || slot.start).split(":")[0]);
      const nextSlotHour =
        existingSlots
          .map((s) => parseInt((s.time || s.start).split(":")[0]))
          .filter((h) => h > slotHour)
          .sort((a, b) => a - b)[0] || 24;
      return problem.hour >= slotHour && problem.hour < nextSlotHour;
    });
  });

  console.log(
    `➕ ${trulyNewProblems.length} truly new slots needed: [${trulyNewProblems
      .map((p) => p.hour)
      .join(", ")}]`
  );
  newSlots.push(...trulyNewProblems);

  console.log(
    `✨ Complete profile view: ${modifications.length} modifications + ${newSlots.length} new slots + ${profileCompliant.length} profile compliant`
  );

  return { modifications, newSlots, profileCompliant };
}
