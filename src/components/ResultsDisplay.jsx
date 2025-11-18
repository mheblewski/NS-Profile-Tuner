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

      <ICRComparisonTable icrData={result.adjustments.newICR} />

      <ISFComparisonTable isfData={result.adjustments.newSens} />

      <HourlyGlucoseDisplay hourlyAvg={result.hourlyAvg} />

      <ResultActions result={result} />
    </div>
  );
}
