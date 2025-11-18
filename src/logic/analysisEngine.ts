/**
 * Main analysis logic that combines all components
 */

import {
  hourlyAverage,
  computeBasalAdjustments,
  analyzeTreatments,
  analyzeHourlyICR,
  type HourlyICRAdjustment,
} from "./dataAnalysis";
import {
  parseLoopProfile,
  applyAdjustmentsToProfile,
  applyHourlyICRAdjustments,
  type ProfileAdjustments,
} from "./profileUtils";

export interface AnalysisResult {
  hourlyAvg: (number | null)[];
  basalAdj: number[];
  icrPct: number;
  isfPct: number;
  hourlyICRAdjustments: HourlyICRAdjustment[];
  adjustments: ProfileAdjustments;
  basalStep: number;
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
  const basalAdj = computeBasalAdjustments(hourlyAvg);

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

  return {
    hourlyAvg,
    basalAdj,
    icrPct,
    isfPct,
    hourlyICRAdjustments,
    adjustments,
    basalStep,
  };
}
