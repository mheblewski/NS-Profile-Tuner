/**
 * Main analysis logic that combines all components
 */

import {
  hourlyAverage,
  computeBasalAdjustments,
  analyzeTreatments,
} from "./dataAnalysis";
import {
  parseLoopProfile,
  applyAdjustmentsToProfile,
  type ProfileAdjustments,
} from "./profileUtils";

export interface AnalysisResult {
  hourlyAvg: (number | null)[];
  basalAdj: number[];
  icrPct: number;
  isfPct: number;
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

  const adjustments = applyAdjustmentsToProfile(
    parsedProfile || profile || {},
    basalAdj,
    icrPct,
    isfPct,
    basalStep
  );

  return {
    hourlyAvg,
    basalAdj,
    icrPct,
    isfPct,
    adjustments,
    basalStep,
  };
}
