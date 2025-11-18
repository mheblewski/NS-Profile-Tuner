import React from "react";
import BasalComparisonTable from "./BasalComparisonTable";
import ICRComparisonTable from "./ICRComparisonTable";
import ISFComparisonTable from "./ISFComparisonTable";
import HourlyGlucoseDisplay from "./HourlyGlucoseDisplay";
import ResultActions from "./ResultActions";

/**
 * Component that displays all analysis results
 */
export default function ResultsDisplay({ result }) {
  if (!result) return null;

  return (
    <div className="space-y-6">
      <BasalComparisonTable
        basalData={result.adjustments.newBasal}
        basalStep={result.basalStep}
      />

      <ICRComparisonTable
        icrData={result.adjustments.newICR}
        icrStructuredData={result.hourlyICRAdjustments}
      />

      <ISFComparisonTable
        isfData={result.adjustments.newSens}
        isfStructuredData={result.hourlyISFAdjustments}
      />

      <HourlyGlucoseDisplay hourlyAvg={result.hourlyAvg} />

      {/* Temporarily hidden - Result actions */}
      {/* <ResultActions result={result} /> */}
    </div>
  );
}
