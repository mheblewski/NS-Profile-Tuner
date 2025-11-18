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

export interface AnalysisResult {
  hourlyAvg: (number | null)[];
  basalAdj: number[];
  icrPct: number;
  isfPct: number;
  hourlyICRAdjustments: HourlyICRAdjustment[];
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
}

/**
 * Performs complete analysis of Nightscout data and builds profile adjustments
 */
export async function performAnalysis(
  entries: any[],
  treatments: any[],
  profile: any,
  basalStep: number = 0.05
): Promise<AnalysisResult> {
  // Calculate hourly averages and basal adjustments
  const hourlyAvg = hourlyAverage(entries);
  const basalAdj = computeBasalAdjustments(hourlyAvg, entries, treatments);

  // Analyze treatments for ICR and ISF adjustments
  const { icrPct, isfPct } = analyzeTreatments(treatments);

  // Parse and apply adjustments to profile
  let parsedProfile = null;
  if (profile) {
    parsedProfile = parseLoopProfile(profile);
  }

  // Analyze hourly ICR effectiveness
  const profileForICR = parsedProfile || profile || {};
  const hourlyICRAdjustments = analyzeHourlyICR(
    entries,
    treatments,
    profileForICR.icr || []
  );

  // Analyze hourly ISF effectiveness
  const hourlyISFAdjustments = analyzeHourlyISF(
    entries,
    treatments,
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
  if (hourlyICRAdjustments.length > 0) {
    adjustments.newICR = applyHourlyICRAdjustments(
      profileForICR,
      hourlyICRAdjustments
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
  if (hourlyICRAdjustments.length > 0) {
    const validationResult = validateProfileRecommendations(
      basalAdj,
      hourlyICRAdjustments,
      entries
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
  };
}
