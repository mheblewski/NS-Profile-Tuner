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
