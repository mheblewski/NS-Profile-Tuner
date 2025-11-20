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
  isNewSlot?: boolean; // True if this is a newly suggested time slot
  isGroupedRecommendation?: boolean; // True if this represents multiple grouped hours
  affectedHours?: number[]; // List of hours affected by this recommendation
  isProfileCompliant?: boolean; // True if current ICR is already good (small change needed)
}

// ICR entry in profile
interface ICREntry {
  time?: string;
  start?: string;
  value: number;
  hour?: number;
}

// Optimized ICR result structure
interface OptimizedICRResult {
  modifications: HourlyICRAdjustment[];
  newSlots: HourlyICRAdjustment[];
  profileCompliant: HourlyICRAdjustment[];
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
): {
  modifications: HourlyICRAdjustment[];
  newSlots: HourlyICRAdjustment[];
  profileCompliant: HourlyICRAdjustment[];
} {
  if (!profileICR || profileICR.length === 0) {
    return { modifications: [], newSlots: [], profileCompliant: [] };
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

  // Apply similar optimization logic as ISF
  const optimizedResults = optimizeICRTimeSlots(adjustments, profileICR);

  return optimizedResults;
}

/**
 * Optimizes ICR time slots by grouping similar adjacent recommendations
 * Returns separate arrays for modifications and new slots
 */
function optimizeICRTimeSlots(
  adjustments: HourlyICRAdjustment[],
  profile: ICREntry[]
): OptimizedICRResult {
  const existingSlots: HourlyICRAdjustment[] = [];
  const newSlots: HourlyICRAdjustment[] = [];
  const compliantSlots: HourlyICRAdjustment[] = [];

  adjustments.forEach((adj) => {
    // Check if there's already a profile slot at this hour
    const existingSlot = profile.find((slot) => {
      const timeStr = slot.time || slot.start;
      if (!timeStr) return false;
      const slotHour = parseInt(timeStr.split(":")[0]);
      return slotHour === adj.hour;
    });

    if (existingSlot) {
      // Check if change is significant (>5% or low confidence)
      const isSignificantChange =
        Math.abs(adj.adjustmentPct) >= 5 && adj.confidence >= 0.3;

      if (isSignificantChange) {
        // Modification to existing slot
        existingSlots.push({
          ...adj,
          isNewSlot: false,
          isGroupedRecommendation: false,
          affectedHours: [adj.hour],
          isProfileCompliant: false,
        });
      } else {
        // Existing slot is already compliant (small change or low confidence)
        compliantSlots.push({
          ...adj,
          isNewSlot: false,
          isGroupedRecommendation: false,
          affectedHours: [adj.hour],
          isProfileCompliant: true,
          // Keep original values for compliant slots
          suggestedICR: adj.currentICR,
          adjustmentPct: 0,
        });
      }
    } else {
      // New slot suggestion (this shouldn't happen with current ICR logic, but keep for completeness)
      if (adj.confidence >= 0.3 && Math.abs(adj.adjustmentPct) >= 10) {
        newSlots.push({
          ...adj,
          isNewSlot: true,
          isGroupedRecommendation: false,
          affectedHours: [adj.hour],
          isProfileCompliant: false,
        });
      }
    }
  });

  return {
    modifications: existingSlots,
    newSlots: newSlots,
    profileCompliant: compliantSlots,
  };
}

// Group consecutive ICR slots with similar values
function groupConsecutiveICRSlots(
  slots: HourlyICRAdjustment[]
): HourlyICRAdjustment[] {
  if (slots.length <= 1) return slots;

  const grouped: HourlyICRAdjustment[] = [];
  let currentGroup = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const current = slots[i];
    const previous = slots[i - 1];

    // Check if slots are consecutive and have similar values
    const isConsecutive = current.hour === previous.hour + 1;
    const isSimilarValue =
      Math.abs(current.suggestedICR - previous.suggestedICR) < 0.5;

    if (isConsecutive && isSimilarValue) {
      currentGroup.push(current);
    } else {
      // Finalize current group and start new one
      if (currentGroup.length > 1) {
        // Create grouped recommendation
        const avgValue =
          currentGroup.reduce((sum, slot) => sum + slot.suggestedICR, 0) /
          currentGroup.length;
        const representativeSlot: HourlyICRAdjustment = {
          ...currentGroup[0],
          suggestedICR: Math.round(avgValue * 10) / 10,
          isGroupedRecommendation: true,
          affectedHours: currentGroup.map((slot) => slot.hour),
        };
        grouped.push(representativeSlot);
      } else {
        grouped.push(currentGroup[0]);
      }
      currentGroup = [current];
    }
  }

  // Handle last group
  if (currentGroup.length > 1) {
    const avgValue =
      currentGroup.reduce((sum, slot) => sum + slot.suggestedICR, 0) /
      currentGroup.length;
    const representativeSlot: HourlyICRAdjustment = {
      ...currentGroup[0],
      suggestedICR: Math.round(avgValue * 10) / 10,
      isGroupedRecommendation: true,
      affectedHours: currentGroup.map((slot) => slot.hour),
    };
    grouped.push(representativeSlot);
  } else {
    grouped.push(currentGroup[0]);
  }

  return grouped;
}
