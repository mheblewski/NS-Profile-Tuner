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
