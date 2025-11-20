import { GlucoseEntry } from "../interfaces/GlucoseEntry";
import { Profile } from "../interfaces/Profile";
import { SuggestedBasalChange } from "../interfaces/SuggestedBasalChange";
import { Treatment } from "../interfaces/Treatment";
import { suggestBasalChanges } from "./dataAnalysis/basal";
import { HourlyICRAdjustment } from "./dataAnalysis/ICR";
import { HourlyISFAdjustment } from "./dataAnalysis/ISF";
import { hourlyAverage } from "./dataAnalysis/utils";
import { ProfileChangeDetector, ProfileChangeResult } from "./profileChanges";
import { type ProfileAdjustments } from "./profileUtils";

/**
 * Interface for profile change analysis results
 */
export interface ProfileChangeAnalysis {
  hasChanges: boolean;
  changes: ProfileChangeResult[];
}

export interface AnalysisResult {
  hourlyAvg: (number | null)[];
  basalChange: SuggestedBasalChange[];
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
 * Performs complete analysis of Nightscout data and builds profile adjustments
 */
export async function performAnalysis(
  entries: GlucoseEntry[],
  treatments: Treatment[],
  profile: Profile,
  basalStep: number = 0.05,
  profileHistory: Profile[] = [],
  days: number = 7
): Promise<AnalysisResult> {
  // const dailyProfileChanges = detectDailyProfileChanges(profileHistory, days);
  const detector = new ProfileChangeDetector(profileHistory, days);
  const dailyProfileChanges = detector.detectChanges();

  const profileChangeAnalysis = {
    hasChanges: dailyProfileChanges.length > 0,
    changes: dailyProfileChanges.map((change: ProfileChangeResult) => ({
      date: new Date(change.day),
      changeType: change.type,
      prev: change.prev,
      curr: change.curr,
    })),
  };

  const hourlyAvg = hourlyAverage(entries);

  const suggestedBasalChanges = suggestBasalChanges(profile.basal, hourlyAvg);

  // // Determine which data to use for analysis
  // let analysisEntries = entries;
  // let analysisTreatments = treatments;

  // if (
  //   profileChangeAnalysis.recommendation.shouldUseSegmentation &&
  //   profileChangeAnalysis.recommendation.segmentToAnalyze
  // ) {
  //   analysisEntries =
  //     profileChangeAnalysis.recommendation.segmentToAnalyze.entries;
  //   analysisTreatments =
  //     profileChangeAnalysis.recommendation.segmentToAnalyze.treatments;
  // }

  // Calculate hourly averages and basal adjustments using segmented data
  // const basalAdj = computeBasalAdjustments(
  //   hourlyAvg,
  //   analysisEntries,
  //   analysisTreatments
  // );

  // // Analyze treatments for ICR and ISF adjustments using segmented data
  // const { icrPct, isfPct } = analyzeTreatments(analysisTreatments);

  // // Parse and apply adjustments to profile
  // let parsedProfile = null;
  // if (profile) {
  //   parsedProfile = parseLoopProfile(profile);
  // }

  // // Analyze hourly ICR effectiveness using segmented data
  // const profileForICR = parsedProfile || profile || {};
  // const hourlyICRAdjustments = analyzeHourlyICR(
  //   analysisEntries,
  //   analysisTreatments,
  //   profileForICR.icr || []
  // );

  // // Mark hourly ICR adjustments for UI display
  // hourlyICRAdjustments.modifications.forEach((adj) => {
  //   adj.isNewSlot = false;
  //   adj.isGroupedRecommendation = false;
  //   adj.affectedHours = [adj.hour];
  //   adj.isProfileCompliant = false;
  // });

  // hourlyICRAdjustments.newSlots.forEach((adj) => {
  //   adj.isNewSlot = true;
  //   adj.isGroupedRecommendation = false;
  //   adj.affectedHours = [adj.hour];
  //   adj.isProfileCompliant = false;
  // });

  // hourlyICRAdjustments.profileCompliant.forEach((adj) => {
  //   adj.isNewSlot = false;
  //   adj.isGroupedRecommendation = false;
  //   adj.affectedHours = [adj.hour];
  //   adj.isProfileCompliant = true;
  // });

  // Analyze hourly ISF effectiveness using segmented data
  // const hourlyISFAdjustments = analyzeHourlyISF(
  //   analysisEntries,
  //   analysisTreatments,
  //   profileForICR.isf || profileForICR.sens || profileForICR.sensitivity || []
  // );

  // const adjustments = applyAdjustmentsToProfile(
  //   profileForICR,
  //   basalAdj,
  //   icrPct,
  //   isfPct,
  //   basalStep
  // );

  // // Apply hourly ICR adjustments (replace the old ICR with new smart one)
  // const totalICRAdjustments = [
  //   ...hourlyICRAdjustments.modifications,
  //   ...hourlyICRAdjustments.newSlots,
  // ];
  // if (totalICRAdjustments.length > 0) {
  //   adjustments.newICR = applyHourlyICRAdjustments(
  //     profileForICR,
  //     totalICRAdjustments
  //   );
  // }

  // Apply hourly ISF adjustments (replace the old ISF with new smart one)
  // if (
  //   hourlyISFAdjustments.modifications.length > 0 ||
  //   hourlyISFAdjustments.newSlots.length > 0 ||
  //   hourlyISFAdjustments.profileCompliant.length > 0
  // ) {
  //   // Convert modifications with proper marking
  //   const modificationsConverted = applyHourlyISFAdjustments(
  //     profileForICR,
  //     hourlyISFAdjustments.modifications
  //   ).map((item) => ({
  //     ...item,
  //     isModification: true,
  //     isNewSlot: false,
  //     isProfileCompliant: false,
  //   }));

  //   // Convert new slots with proper marking
  //   const newSlotsConverted = applyHourlyISFAdjustments(
  //     profileForICR,
  //     hourlyISFAdjustments.newSlots
  //   ).map((item) => ({
  //     ...item,
  //     isModification: false,
  //     isNewSlot: true,
  //     isProfileCompliant: false,
  //   }));

  // Convert profile compliant with proper marking
  //   const profileCompliantConverted = applyHourlyISFAdjustments(
  //     profileForICR,
  //     hourlyISFAdjustments.profileCompliant
  //   ).map((item) => ({
  //     ...item,
  //     isModification: false,
  //     isNewSlot: false,
  //     isProfileCompliant: true,
  //   }));

  //   adjustments.newSens = [
  //     ...modificationsConverted,
  //     ...newSlotsConverted,
  //     ...profileCompliantConverted,
  //   ];
  // }

  // Validate recommendations for conflicts
  // let validation;
  // if (totalICRAdjustments.length > 0) {
  //   const validationResult = validateProfileRecommendations(
  //     basalAdj,
  //     totalICRAdjustments,
  //     analysisEntries // Use segmented entries for validation
  //   );

  //   validation = {
  //     ...validationResult,
  //     hasSignificantConflicts: validationResult.conflicts.some(
  //       (c) =>
  //         c.conflictSeverity === "high" ||
  //         Math.abs(c.basalChange) > 20 ||
  //         Math.abs(c.icrChange) > 20
  //     ),
  //   };
  // }

  return {
    hourlyAvg,
    basalChange: suggestedBasalChanges,
    // basalAdj,
    // icrPct,
    // isfPct,
    // hourlyICRAdjustments,
    // hourlyISFAdjustments,
    // adjustments,
    basalStep,
    // validation,
    profileChangeAnalysis,
  } as any;
}
