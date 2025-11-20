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
  time?: string; // Full slot time (HH:mm)
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
  // Safety check for profile ISF
  if (!profileISF || profileISF.length === 0) {
    return { modifications: [], newSlots: [], profileCompliant: [] };
  }

  // Validate ISF profile structure
  const validISFSlots = profileISF.filter(
    (slot) => slot && (slot.time || slot.start) && slot.value !== undefined
  );

  if (validISFSlots.length === 0) {
    return { modifications: [], newSlots: [], profileCompliant: [] };
  }

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

  const cleanCorrections = allCorrections.filter((c: any) => !c.nearbyMeal);

  const result = analyzeAllHoursForISF(
    allCorrections,
    hourlyISFMap,
    validISFSlots
  );

  return result;
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
    const timeKey = isfSlot.time || isfSlot.start;
    groups[timeKey] = [];
  });

  // Map each correction to the appropriate ISF time slot
  correctionAnalyses.forEach((correction) => {
    // Ensure correction.minute exists (if not, set to 0 or extract from timestamp if available)
    const corr = correction as typeof correction & { minute?: number };
    if (corr.minute === undefined) {
      if (corr.timestamp) {
        const d = new Date(corr.timestamp);
        corr.minute = d.getMinutes();
      } else {
        corr.minute = 0;
      }
    }
    // Find which ISF time slot this correction belongs to (by full time, not just hour)
    let applicableTimeKey =
      profileISF[0] && (profileISF[0].time || profileISF[0].start);
    for (let i = profileISF.length - 1; i >= 0; i--) {
      const isfSlot = profileISF[i];
      if (!isfSlot || (!isfSlot.time && !isfSlot.start)) continue;
      const slotTime = isfSlot.time || isfSlot.start;
      const [slotHour, slotMin] = slotTime.split(":").map(Number);
      if (
        corr.hour > slotHour ||
        (corr.hour === slotHour && (corr.minute ?? 0) >= slotMin)
      ) {
        applicableTimeKey = slotTime;
        break;
      }
    }
    // Wrap-around: before first slot
    const firstSlot = profileISF[0];
    const lastSlot = profileISF[profileISF.length - 1];
    if (
      firstSlot &&
      (firstSlot.time || firstSlot.start) &&
      (corr.hour < Number((firstSlot.time || firstSlot.start).split(":")[0]) ||
        (corr.hour ===
          Number((firstSlot.time || firstSlot.start).split(":")[0]) &&
          (corr.minute ?? 0) <
            Number((firstSlot.time || firstSlot.start).split(":")[1])))
    ) {
      applicableTimeKey = lastSlot.time || lastSlot.start;
    }
    if (groups[applicableTimeKey]) {
      groups[applicableTimeKey].push(corr);
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

  // --- SAFETY GUARD: Block ISF reduction if hypoglycemia or temp basal 0 detected ---
  // 1. Check for hypoglycemia (<70 mg/dL) in the hour
  // 2. Check for temp basal 0 in the hour
  let blockISFReduction = false;
  try {
    // Find all pre/post glucose values for this hour
    const allGlucoses = validCorrections.flatMap((c) =>
      [c.preGlucose, c.glucoseAt2h, c.glucoseAt3h].filter((v) => v !== null)
    );
    if (allGlucoses.some((g) => g !== null && g < 70)) {
      blockISFReduction = true;
    }
    // Check for temp basal 0 in corrections (if any correctionInsulin == 0 and from temp basal)
    if (validCorrections.some((c) => c.correctionInsulin === 0)) {
      blockISFReduction = true;
    }
  } catch (e) {}

  const successRate =
    validCorrections.filter((c) => c.success).length / validCorrections.length;
  const avgEfficiency =
    validCorrections.reduce((sum, c) => sum + (c.efficiency || 0), 0) /
    validCorrections.length;

  // Calculate suggested ISF based on average efficiency
  let suggestedISF = currentISF;
  let adjustmentPct = 0;

  if (avgEfficiency > 0) {
    // Jeśli efektywność > target, insulina działa mocniej → ISF powinien rosnąć
    // Jeśli efektywność < target, insulina działa słabiej → ISF powinien maleć
    const targetEfficiency = 0.9;
    const efficiencyRatio = avgEfficiency / targetEfficiency;

    // Nowy ISF: im większa efektywność, tym większy ISF
    const theoreticalSuggestedISF = currentISF * efficiencyRatio;
    let theoreticalAdjustmentPct =
      ((theoreticalSuggestedISF - currentISF) / currentISF) * 100;

    // SAFETY: If blockISFReduction, do not allow ISF to decrease (no negative adjustment)
    if (blockISFReduction && theoreticalSuggestedISF < currentISF) {
      suggestedISF = currentISF;
      adjustmentPct = 0;
    } else {
      // Clamp adjustment to max ±30%
      let unclampedISF = Math.max(10, theoreticalSuggestedISF);
      let unclampedPct = ((unclampedISF - currentISF) / currentISF) * 100;
      let clampedPct = Math.max(-30, Math.min(30, unclampedPct));
      suggestedISF = currentISF * (1 + clampedPct / 100);
      adjustmentPct = clampedPct;
    }
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

  const results: HourlyISFAdjustment[] = [];
  const existingSlotTimes = existingSlots.map(
    (slot) => slot.time || slot.start
  );

  // Analyze each hour
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 1) {
      const corrections = (correctionsByHour[hour] || []).filter(
        (c: any) => !c.nearbyMeal && (c.minute ?? 0) === minute
      );
      if (corrections.length === 0) continue;
      const currentISF = hourlyISFMap[hour];
      const adjustment = calculateHourlyISFAdjustment(
        hour,
        currentISF,
        corrections
      );
      // Find matching slot time (HH:mm)
      const slotTime = existingSlotTimes.find((t) => {
        const [h, m] = t.split(":").map(Number);
        return h === hour && m === minute;
      });
      const isNewSlot = !slotTime;
      const isSignificantChange = Math.abs(adjustment.adjustmentPct) >= 10;
      const isProfileCompliant =
        !isNewSlot && !isSignificantChange && corrections.length >= 2;
      if (
        !isNewSlot ||
        (isNewSlot && isSignificantChange && corrections.length >= 2) ||
        isProfileCompliant
      ) {
        results.push({
          ...adjustment,
          time:
            slotTime ||
            `${hour.toString().padStart(2, "0")}:${minute
              .toString()
              .padStart(2, "0")}`,
          isNewSlot: isNewSlot,
          isProfileCompliant: isProfileCompliant,
        });
      }
    }
  }

  // NEW: Intelligent grouping and split into modifications vs new slots
  const optimizedResults = optimizeISFTimeSlots(results, existingSlots);

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

  const modifications: HourlyISFAdjustment[] = [];
  const newSlots: HourlyISFAdjustment[] = [];
  const profileCompliant: HourlyISFAdjustment[] = [];

  // Extract profile compliant entries
  const needsOptimization = results.filter((r) => !r.isProfileCompliant);
  const compliantEntries = results.filter((r) => r.isProfileCompliant);

  profileCompliant.push(...compliantEntries);

  // NEW APPROACH: Show each existing profile slot separately
  // Create a mapping of which problems affect which existing slots
  const existingSlotTimes = existingSlots.map(
    (slot) => slot.time || slot.start
  );

  // For each existing slot, determine if it needs changes based on analysis results
  existingSlots.forEach((slot, idx) => {
    const slotTime = slot.time || slot.start;
    const currentISF = slot.value;
    // Find analysis results that would be covered by this slot (from slotTime to nextSlotTime)
    const nextSlotTime = existingSlots[idx + 1]
      ? existingSlots[idx + 1].time || existingSlots[idx + 1].start
      : null;
    const [slotHour, slotMin] = slotTime.split(":").map(Number);
    let nextSlotHour = 24,
      nextSlotMin = 0;
    if (nextSlotTime) {
      [nextSlotHour, nextSlotMin] = nextSlotTime.split(":").map(Number);
    }
    // Find problems in the range covered by this slot
    const problemsInRange = needsOptimization.filter((problem) => {
      if (!problem.time) return false;
      const [pHour, pMin] = problem.time.split(":").map(Number);
      if (nextSlotTime) {
        // Between slotTime (inclusive) and nextSlotTime (exclusive)
        if (
          (pHour > slotHour || (pHour === slotHour && pMin >= slotMin)) &&
          (pHour < nextSlotHour ||
            (pHour === nextSlotHour && pMin < nextSlotMin))
        ) {
          return true;
        }
        return false;
      } else {
        // Last slot: from slotTime to end of day
        return pHour > slotHour || (pHour === slotHour && pMin >= slotMin);
      }
    });
    if (problemsInRange.length > 0) {
      // This slot needs modification - use the most confident suggestion
      const bestProblem = problemsInRange.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      modifications.push({
        hour: slotHour,
        time: slotTime,
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
        time: slotTime,
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
    if (!problem.time) return true;
    return !existingSlotTimes.some((slotTime, idx) => {
      const [slotHour, slotMin] = slotTime.split(":").map(Number);
      let nextSlotHour = 24,
        nextSlotMin = 0;
      if (existingSlotTimes[idx + 1]) {
        [nextSlotHour, nextSlotMin] = existingSlotTimes[idx + 1]
          .split(":")
          .map(Number);
      }
      const [pHour, pMin] = problem.time!.split(":").map(Number);
      if (existingSlotTimes[idx + 1]) {
        // Between slotTime (inclusive) and nextSlotTime (exclusive)
        if (
          (pHour > slotHour || (pHour === slotHour && pMin >= slotMin)) &&
          (pHour < nextSlotHour ||
            (pHour === nextSlotHour && pMin < nextSlotMin))
        ) {
          return true;
        }
        return false;
      } else {
        // Last slot: from slotTime to end of day
        return pHour > slotHour || (pHour === slotHour && pMin >= slotMin);
      }
    });
  });

  newSlots.push(...trulyNewProblems);

  return { modifications, newSlots, profileCompliant };
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
