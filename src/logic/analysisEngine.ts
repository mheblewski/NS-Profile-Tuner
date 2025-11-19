/**
 * Detects profile changes day by day in the analysis period
 * For each day, finds the active profile and compares basal, ICR, ISF to previous day
 * Reports changes with date and details (slot value, count, time changes)
 */
export function detectDailyProfileChanges(profileHistory: any[], days: number) {
  if (!profileHistory || profileHistory.length === 0) return [];

  // Sort profile history by timestamp ascending
  const sorted = [...profileHistory].sort((a, b) => {
    const ta = parseInt(a.created_at || a.mills || a.timestamp);
    const tb = parseInt(b.created_at || b.mills || b.timestamp);
    return ta - tb;
  });

  // Build a map: day (YYYY-MM-DD) -> latest profile for that day
  const dayToProfile = new Map();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days + 1);
  for (let d = 0; d < days; d++) {
    const day = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().slice(0, 10);
    // Find latest profile before or at this day
    let latest = null;
    for (const p of sorted) {
      const pt = parseInt(p.created_at || p.mills || p.timestamp);
      if (
        pt <=
        day.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000
      ) {
        latest = p;
      } else {
        break;
      }
    }
    if (latest) dayToProfile.set(dayStr, latest);
  }

  // Compare day by day
  const changes = [];
  let prevProfile = null;
  for (let d = 0; d < days; d++) {
    const day = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().slice(0, 10);
    const profile = dayToProfile.get(dayStr);
    if (!profile) continue;
    if (prevProfile) {
      const store1Name =
        prevProfile.defaultProfile || Object.keys(prevProfile.store)[0];
      const store2Name =
        profile.defaultProfile || Object.keys(profile.store)[0];
      const store1 = prevProfile.store[store1Name];
      const store2 = profile.store[store2Name];
      // Compare basal, ICR, ISF slot arrays
      const compareSlots = (arr1, arr2) => {
        if (!arr1 && !arr2) return false;
        if (!arr1 || !arr2) return true;
        if (arr1.length !== arr2.length) return true;
        for (let i = 0; i < arr1.length; i++) {
          if (arr1[i].time !== arr2[i].time) return true;
          if (parseFloat(arr1[i].value) !== parseFloat(arr2[i].value))
            return true;
        }
        return false;
      };
      if (compareSlots(store1?.basal, store2?.basal)) {
        changes.push({
          day: dayStr,
          type: "basal",
          prev: {
            basal: store1?.basal || [],
            icr: store1?.carbratio || store1?.icr || [],
            isf: store1?.sens || store1?.sensitivity || [],
          },
          curr: {
            basal: store2?.basal || [],
            icr: store2?.carbratio || store2?.icr || [],
            isf: store2?.sens || store2?.sensitivity || [],
          },
        });
      }
      if (
        compareSlots(
          store1?.carbratio || store1?.icr,
          store2?.carbratio || store2?.icr
        )
      ) {
        changes.push({
          day: dayStr,
          type: "icr",
          prev: {
            basal: store1?.basal || [],
            icr: store1?.carbratio || store1?.icr || [],
            isf: store1?.sens || store1?.sensitivity || [],
          },
          curr: {
            basal: store2?.basal || [],
            icr: store2?.carbratio || store2?.icr || [],
            isf: store2?.sens || store2?.sensitivity || [],
          },
        });
      }
      if (
        compareSlots(
          store1?.sens || store1?.sensitivity,
          store2?.sens || store2?.sensitivity
        )
      ) {
        changes.push({
          day: dayStr,
          type: "isf",
          prev: {
            basal: store1?.basal || [],
            icr: store1?.carbratio || store1?.icr || [],
            isf: store1?.sens || store1?.sensitivity || [],
          },
          curr: {
            basal: store2?.basal || [],
            icr: store2?.carbratio || store2?.icr || [],
            isf: store2?.sens || store2?.sensitivity || [],
          },
        });
      }
    }
    prevProfile = profile;
  }
  return changes;
}
/**
 * Main analysis logic that combines all components
 */

import {
  hourlyAverage,
  computeBasalAdjustments,
  analyzeTreatments,
  analyzeHourlyICR,
  analyzeHourlyISF,
  validateProfileRecommendations,
  type HourlyICRAdjustment,
  type HourlyISFAdjustment,
} from "./dataAnalysis";
import {
  parseLoopProfile,
  applyAdjustmentsToProfile,
  applyHourlyICRAdjustments,
  applyHourlyISFAdjustments,
  type ProfileAdjustments,
} from "./profileUtils";

/**
 * Interface for profile change detection
 */
export interface ProfileChange {
  timestamp: string;
  date: Date;
  profileName?: string;
  profile: any;
  changeType: "profile_switch" | "profile_update";
  slotLevelDetails?: Record<
    string,
    Array<{
      slot: string;
      oldValue: number;
      newValue: number;
      deltaPct: number;
    }>
  >;
}

/**
 * Interface for data segmentation based on profile changes
 */
export interface DataSegment {
  startDate: Date;
  endDate: Date;
  profile: any;
  entries: any[];
  treatments: any[];
  isCurrentSegment: boolean;
}

/**
 * Interface for profile change analysis results
 */
export interface ProfileChangeAnalysis {
  hasChanges: boolean;
  changes: ProfileChange[];
  segments: DataSegment[];
  currentSegment: DataSegment | null;
  recommendation: {
    shouldUseSegmentation: boolean;
    reason: string;
    segmentToAnalyze?: DataSegment;
  };
}

export interface AnalysisResult {
  hourlyAvg: (number | null)[];
  basalAdj: number[];
  icrPct: number;
  isfPct: number;
  hourlyICRAdjustments: {
    modifications: HourlyICRAdjustment[];
    newSlots: HourlyICRAdjustment[];
    profileCompliant: HourlyICRAdjustment[];
  };
  hourlyISFAdjustments: {
    modifications: HourlyISFAdjustment[];
    newSlots: HourlyISFAdjustment[];
    profileCompliant: HourlyISFAdjustment[];
  };
  adjustments: ProfileAdjustments;
  basalStep: number;
  validation?: {
    conflicts: any[];
    overallCoherence: number;
    hasSignificantConflicts: boolean;
  };
  profileChangeAnalysis?: ProfileChangeAnalysis;
}

/**
 * Compares two profiles to detect actual value changes
 */
function detectProfileValueChanges(profile1: any, profile2: any) {
  const store1Name = profile1.defaultProfile || Object.keys(profile1.store)[0];
  const store2Name = profile2.defaultProfile || Object.keys(profile2.store)[0];
  const store1 = profile1.store[store1Name];
  const store2 = profile2.store[store2Name];
  const changes: string[] = [];
  const slotLevelDetails: Record<string, Array<any>> = {};
  if (!profile1?.store || !profile2?.store) {
    return { hasChanges: false, changes: [], slotLevelDetails };
  }

  if (!store1 || !store2) {
    return { hasChanges: false, changes: [], slotLevelDetails };
  }

  // Helper function: match slots by time, report all changes
  const hasSignificantChange = (
    arr1: any[],
    arr2: any[],
    threshold = 0.1,
    fieldName = ""
  ): boolean => {
    if (!arr1 || !arr2) return true;
    // Build maps by time for robust comparison
    const map1 = new Map((arr1 || []).map((s) => [s.time, s]));
    const map2 = new Map((arr2 || []).map((s) => [s.time, s]));
    const allTimes = Array.from(new Set([...map1.keys(), ...map2.keys()]));
    let changedValues = 0;
    slotLevelDetails[fieldName] = [];
    for (const time of allTimes) {
      const slot1 = map1.get(time);
      const slot2 = map2.get(time);
      const val1 = slot1 ? parseFloat(slot1.value) : undefined;
      const val2 = slot2 ? parseFloat(slot2.value) : undefined;
      let actualThreshold = threshold;
      if (fieldName === "basal") actualThreshold = 0.1;
      if (fieldName === "icr") actualThreshold = 0.1;
      if (fieldName === "isf") actualThreshold = 0.1;
      let changed = false;
      let deltaPct = 0;
      if (val1 === undefined || val2 === undefined) {
        if (val1 !== val2) changed = true;
      } else {
        // Correct calculation: (new - old) / old * 100
        deltaPct =
          val1 !== 0 ? ((val2 - val1) / val1) * 100 : val2 !== 0 ? 100 : 0;
        const diff = Math.abs(val2 - val1) / Math.max(Math.abs(val1), 0.01);
        if (diff > actualThreshold) changed = true;
      }
      if (changed) {
        changedValues++;
        slotLevelDetails[fieldName].push({
          slot: time,
          oldValue: val1,
          newValue: val2,
          deltaPct: deltaPct,
        });
      }
    }
    // Also report slot count change if different
    if (arr1.length !== arr2.length) {
      slotLevelDetails[fieldName].push({
        slot: "count",
        oldValue: arr1.length,
        newValue: arr2.length,
        deltaPct: 100,
      });
      changedValues++;
    }
    return changedValues >= 1;
  };
  // (duplicate logs removed)

  if (hasSignificantChange(store1.basal, store2.basal, 0.1, "basal")) {
    changes.push("basal rates");
  }
  if (
    hasSignificantChange(
      store1.carbratio || store1.icr,
      store2.carbratio || store2.icr,
      0.1,
      "icr"
    )
  ) {
    changes.push("ICR (insulin-to-carb ratio)");
  }
  if (
    hasSignificantChange(
      store1.sens || store1.sensitivity,
      store2.sens || store2.sensitivity,
      0.1,
      "isf"
    )
  ) {
    changes.push("ISF (insulin sensitivity factor)");
  }
  // Compare targets (exact match for targets as they're usually discrete values)
  const target1Low = JSON.stringify(store1.target_low || store1.target);
  const target2Low = JSON.stringify(store2.target_low || store2.target);
  const target1High = JSON.stringify(store1.target_high);
  const target2High = JSON.stringify(store2.target_high);
  if (target1Low !== target2Low || target1High !== target2High) {
    const hasSignificantTargetChange = () => {
      try {
        const t1Low = store1.target_low || store1.target;
        const t2Low = store2.target_low || store2.target;
        const t1High = store1.target_high;
        const t2High = store2.target_high;
        if (Array.isArray(t1Low) && Array.isArray(t2Low)) {
          if (t1Low.length !== t2Low.length) return true;
          for (let i = 0; i < t1Low.length; i++) {
            const diff = Math.abs(
              parseFloat(t1Low[i].value) - parseFloat(t2Low[i].value)
            );
            if (diff > 5) return true;
          }
        }
        if (Array.isArray(t1High) && Array.isArray(t2High)) {
          if (t1High.length !== t2High.length) return true;
          for (let i = 0; i < t1High.length; i++) {
            const diff = Math.abs(
              parseFloat(t1High[i].value) - parseFloat(t2High[i].value)
            );
            if (diff > 5) return true;
          }
        }
        return false;
      } catch (e) {
        return true;
      }
    };
    if (hasSignificantTargetChange()) {
      changes.push("target glucose");
    }
  }
  return {
    hasChanges: changes.length > 0,
    changes,
    slotLevelDetails,
  };
}

/**
 * Detects profile changes and segments data accordingly
 */
export function detectProfileChanges(
  treatments: any[],
  profileHistory: any[],
  entries: any[],
  days: number
): ProfileChangeAnalysis {
  const changes: ProfileChange[] = [];

  // Find Profile Switch events in treatments
  const profileSwitches = (treatments || [])
    .filter((t) => t.eventType === "Profile Switch")
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || a.date).getTime();
      const timeB = new Date(b.timestamp || b.created_at || b.date).getTime();
      return timeA - timeB;
    });

  // Find profile updates in profile history
  const profileUpdates = (profileHistory || [])
    .filter((p) => p && (p.created_at || p.mills || p.timestamp))
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.mills || a.timestamp).getTime();
      const timeB = new Date(b.created_at || b.mills || b.timestamp).getTime();
      return timeA - timeB;
    });

  // Check if we have a current profile to compare against
  const profileAnalysisStartDate = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  );

  // Filter profile updates to analysis period and analyze for changes
  const recentProfileUpdates = profileUpdates.filter((pu) => {
    const timestamp = pu.created_at || pu.mills || pu.timestamp;
    const updateDate = new Date(parseInt(timestamp)); // Convert string to number first
    return updateDate >= profileAnalysisStartDate;
  });

  // Compare profiles for actual value changes
  let detectedProfileChanges: any[] = [];
  // 1. Compare consecutive profiles (as before)
  if (recentProfileUpdates.length >= 2) {
    for (let i = 1; i < recentProfileUpdates.length; i++) {
      const prevProfile = recentProfileUpdates[i - 1];
      const currentProfile = recentProfileUpdates[i];
      const timeDiff = Math.abs(
        new Date(
          parseInt(
            currentProfile.created_at ||
              currentProfile.mills ||
              currentProfile.timestamp
          )
        ).getTime() -
          new Date(
            parseInt(
              prevProfile.created_at ||
                prevProfile.mills ||
                prevProfile.timestamp
            )
          ).getTime()
      );
      if (timeDiff < 2 * 60 * 60 * 1000) continue;
      const sameProfileName =
        prevProfile.defaultProfile === currentProfile.defaultProfile;
      const hasChanges = detectProfileValueChanges(prevProfile, currentProfile);
      if (hasChanges.hasChanges) {
        const meaningfulChanges = hasChanges.changes.filter(
          (change) => change !== "target glucose"
        );
        if (sameProfileName) {
          const minGapForSameProfile = 1 * 60 * 60 * 1000;
          if (
            timeDiff >= minGapForSameProfile &&
            meaningfulChanges.length > 0
          ) {
            detectedProfileChanges.push({
              profile: currentProfile,
              timestamp:
                currentProfile.created_at ||
                currentProfile.mills ||
                currentProfile.timestamp,
              changes: meaningfulChanges,
              slotLevelDetails: hasChanges.slotLevelDetails || {},
              compareType: "consecutive",
              comparedTo:
                prevProfile.created_at ||
                prevProfile.mills ||
                prevProfile.timestamp,
            });
          }
        } else {
          if (hasChanges.changes.length > 0) {
            detectedProfileChanges.push({
              profile: currentProfile,
              timestamp:
                currentProfile.created_at ||
                currentProfile.mills ||
                currentProfile.timestamp,
              changes: hasChanges.changes,
              slotLevelDetails: hasChanges.slotLevelDetails || {},
              compareType: "consecutive",
              comparedTo:
                prevProfile.created_at ||
                prevProfile.mills ||
                prevProfile.timestamp,
            });
          }
        }
      }
    }
  }

  // Combine and deduplicate profile changes
  profileSwitches.forEach((ps) => {
    const timestamp = ps.timestamp || ps.created_at || ps.date;
    if (!timestamp) return;

    changes.push({
      timestamp,
      date: new Date(parseInt(timestamp)),
      profileName: ps.profile,
      profile: ps,
      changeType: "profile_switch",
    });
  });

  // Add detected profile value changes
  detectedProfileChanges.forEach((change) => {
    changes.push({
      timestamp: change.timestamp,
      date: new Date(parseInt(change.timestamp)),
      profileName: "Profile Update",
      profile: change.profile,
      changeType: "profile_update",
      slotLevelDetails: change.slotLevelDetails || {},
    });
  });

  // Remove automatic addition of recent profile updates without actual changes
  // This was causing false positives

  // Sort all changes by date
  changes.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Remove duplicates (changes within 5 minutes of each other)
  const uniqueChanges: ProfileChange[] = [];
  changes.forEach((change) => {
    const isDuplicate = uniqueChanges.some(
      (existing) =>
        Math.abs(change.date.getTime() - existing.date.getTime()) <
        5 * 60 * 1000
    );
    if (!isDuplicate) {
      uniqueChanges.push(change);
    }
  });

  // Create data segments
  const segments: DataSegment[] = [];
  const mainAnalysisStartDate = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  );
  const analysisEndDate = new Date();

  if (uniqueChanges.length === 0) {
    // No changes detected, use entire dataset
    segments.push({
      startDate: mainAnalysisStartDate,
      endDate: analysisEndDate,
      profile: null,
      entries: entries || [],
      treatments: treatments || [],
      isCurrentSegment: true,
    });
  } else {
    // Create segments between changes
    let segmentStart = mainAnalysisStartDate;

    for (let i = 0; i < uniqueChanges.length; i++) {
      const change = uniqueChanges[i];

      // Create segment before this change (if it's within analysis period)
      if (change.date > mainAnalysisStartDate) {
        const segmentEnd = change.date;

        segments.push({
          startDate: segmentStart,
          endDate: segmentEnd,
          profile: i > 0 ? uniqueChanges[i - 1].profile : null,
          entries: filterDataByTimeRange(entries, segmentStart, segmentEnd),
          treatments: filterDataByTimeRange(
            treatments,
            segmentStart,
            segmentEnd
          ),
          isCurrentSegment: false,
        });

        segmentStart = change.date;
      }
    }

    // Create final segment (current)
    segments.push({
      startDate: segmentStart,
      endDate: analysisEndDate,
      profile: uniqueChanges[uniqueChanges.length - 1].profile,
      entries: filterDataByTimeRange(entries, segmentStart, analysisEndDate),
      treatments: filterDataByTimeRange(
        treatments,
        segmentStart,
        analysisEndDate
      ),
      isCurrentSegment: true,
    });
  }

  const hasChanges = uniqueChanges.length > 0;
  const currentSegment = segments.find((s) => s.isCurrentSegment) || null;

  // Determine recommendation
  let shouldUseSegmentation = false;
  let reason = "No profile changes detected in analysis period";
  let segmentToAnalyze = segments[0];

  if (hasChanges && currentSegment) {
    const currentSegmentDays =
      (currentSegment.endDate.getTime() - currentSegment.startDate.getTime()) /
      (24 * 60 * 60 * 1000);

    if (currentSegmentDays >= 1) {
      // Current segment has enough data (at least 1 day)
      shouldUseSegmentation = true;
      reason = `Profile changed ${
        uniqueChanges.length
      } time(s). Using only data after last change (${currentSegmentDays.toFixed(
        1
      )} days).`;
      segmentToAnalyze = currentSegment;
    } else if (currentSegmentDays < 1 && segments.length > 1) {
      // Current segment too short, but we can warn user
      shouldUseSegmentation = false;
      reason = `Profile changed recently (${currentSegmentDays.toFixed(
        1
      )} days ago). Not enough data in current segment. Using all data with caution.`;
      segmentToAnalyze = segments[0]; // Use full dataset but with warning
    }
  }

  return {
    hasChanges,
    changes: uniqueChanges,
    segments,
    currentSegment,
    recommendation: {
      shouldUseSegmentation,
      reason,
      segmentToAnalyze,
    },
  };
}

/**
 * Filters data array by time range
 */
function filterDataByTimeRange(
  data: any[],
  startDate: Date,
  endDate: Date
): any[] {
  if (!data || !Array.isArray(data)) return [];

  return data.filter((item) => {
    const itemTime = new Date(
      item.dateString || item.timestamp || item.created_at || item.date
    );

    return itemTime >= startDate && itemTime <= endDate;
  });
}

/**
 * Performs complete analysis of Nightscout data and builds profile adjustments
 */
export async function performAnalysis(
  entries: any[],
  treatments: any[],
  profile: any,
  basalStep: number = 0.05,
  profileHistory: any[] = [],
  days: number = 7
): Promise<AnalysisResult> {
  // Detect daily profile changes (new logic)
  const dailyProfileChanges = detectDailyProfileChanges(profileHistory, days);
  // Build a compatible object for ProfileChangeWarning
  const profileChangeAnalysis = {
    hasChanges: dailyProfileChanges.length > 0,
    changes: dailyProfileChanges.map((change) => ({
      date: new Date(change.day),
      changeType: change.type,
      prev: change.prev,
      curr: change.curr,
    })),
    recommendation: {
      shouldUseSegmentation: false,
      reason: "",
    },
    segments: [],
    currentSegment: null,
  };

  // Determine which data to use for analysis
  let analysisEntries = entries;
  let analysisTreatments = treatments;

  if (
    profileChangeAnalysis.recommendation.shouldUseSegmentation &&
    profileChangeAnalysis.recommendation.segmentToAnalyze
  ) {
    analysisEntries =
      profileChangeAnalysis.recommendation.segmentToAnalyze.entries;
    analysisTreatments =
      profileChangeAnalysis.recommendation.segmentToAnalyze.treatments;
  }

  // Calculate hourly averages and basal adjustments using segmented data
  const hourlyAvg = hourlyAverage(analysisEntries);
  const basalAdj = computeBasalAdjustments(
    hourlyAvg,
    analysisEntries,
    analysisTreatments
  );

  // Analyze treatments for ICR and ISF adjustments using segmented data
  const { icrPct, isfPct } = analyzeTreatments(analysisTreatments);

  // Parse and apply adjustments to profile
  let parsedProfile = null;
  if (profile) {
    parsedProfile = parseLoopProfile(profile);
  }

  // Analyze hourly ICR effectiveness using segmented data
  const profileForICR = parsedProfile || profile || {};
  const hourlyICRAdjustments = analyzeHourlyICR(
    analysisEntries,
    analysisTreatments,
    profileForICR.icr || []
  );

  // Mark hourly ICR adjustments for UI display
  hourlyICRAdjustments.modifications.forEach((adj) => {
    adj.isNewSlot = false;
    adj.isGroupedRecommendation = false;
    adj.affectedHours = [adj.hour];
    adj.isProfileCompliant = false;
  });

  hourlyICRAdjustments.newSlots.forEach((adj) => {
    adj.isNewSlot = true;
    adj.isGroupedRecommendation = false;
    adj.affectedHours = [adj.hour];
    adj.isProfileCompliant = false;
  });

  hourlyICRAdjustments.profileCompliant.forEach((adj) => {
    adj.isNewSlot = false;
    adj.isGroupedRecommendation = false;
    adj.affectedHours = [adj.hour];
    adj.isProfileCompliant = true;
  });

  // Analyze hourly ISF effectiveness using segmented data
  const hourlyISFAdjustments = analyzeHourlyISF(
    analysisEntries,
    analysisTreatments,
    profileForICR.isf || profileForICR.sens || profileForICR.sensitivity || []
  );

  const adjustments = applyAdjustmentsToProfile(
    profileForICR,
    basalAdj,
    icrPct,
    isfPct,
    basalStep
  );

  // Apply hourly ICR adjustments (replace the old ICR with new smart one)
  const totalICRAdjustments = [
    ...hourlyICRAdjustments.modifications,
    ...hourlyICRAdjustments.newSlots,
  ];
  if (totalICRAdjustments.length > 0) {
    adjustments.newICR = applyHourlyICRAdjustments(
      profileForICR,
      totalICRAdjustments
    );
  }

  // Apply hourly ISF adjustments (replace the old ISF with new smart one)
  if (
    hourlyISFAdjustments.modifications.length > 0 ||
    hourlyISFAdjustments.newSlots.length > 0 ||
    hourlyISFAdjustments.profileCompliant.length > 0
  ) {
    // Convert modifications with proper marking
    const modificationsConverted = applyHourlyISFAdjustments(
      profileForICR,
      hourlyISFAdjustments.modifications
    ).map((item) => ({
      ...item,
      isModification: true,
      isNewSlot: false,
      isProfileCompliant: false,
    }));

    // Convert new slots with proper marking
    const newSlotsConverted = applyHourlyISFAdjustments(
      profileForICR,
      hourlyISFAdjustments.newSlots
    ).map((item) => ({
      ...item,
      isModification: false,
      isNewSlot: true,
      isProfileCompliant: false,
    }));

    // Convert profile compliant with proper marking
    const profileCompliantConverted = applyHourlyISFAdjustments(
      profileForICR,
      hourlyISFAdjustments.profileCompliant
    ).map((item) => ({
      ...item,
      isModification: false,
      isNewSlot: false,
      isProfileCompliant: true,
    }));

    adjustments.newSens = [
      ...modificationsConverted,
      ...newSlotsConverted,
      ...profileCompliantConverted,
    ];
  }

  // Validate recommendations for conflicts
  let validation;
  if (totalICRAdjustments.length > 0) {
    const validationResult = validateProfileRecommendations(
      basalAdj,
      totalICRAdjustments,
      analysisEntries // Use segmented entries for validation
    );

    validation = {
      ...validationResult,
      hasSignificantConflicts: validationResult.conflicts.some(
        (c) =>
          c.conflictSeverity === "high" ||
          Math.abs(c.basalChange) > 20 ||
          Math.abs(c.icrChange) > 20
      ),
    };
  }

  return {
    hourlyAvg,
    basalAdj,
    icrPct,
    isfPct,
    hourlyICRAdjustments,
    hourlyISFAdjustments,
    adjustments,
    basalStep,
    validation,
    profileChangeAnalysis, // Include profile change analysis in results
  };
}
