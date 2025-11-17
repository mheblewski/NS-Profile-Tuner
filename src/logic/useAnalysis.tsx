import { useState } from "react";
import { performAnalysis, type AnalysisResult } from "./analysisEngine";
import {
  extractErrorMessage,
  logError,
  validateAnalysisData,
} from "./validationUtils";

export interface AnalysisData {
  entries: any;
  treatments: any;
  profile: any;
}

/**
 * Custom hook for managing analysis state and operations
 */
export function useAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function runAnalysis(data: AnalysisData) {
    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      // Validate input data
      validateAnalysisData(data);

      const analysisResult = await performAnalysis(
        data.entries,
        data.treatments,
        data.profile
      );

      setResult(analysisResult);
      return analysisResult;
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      setAnalysisError(errorMessage);
      logError("Analysis failed", err);
      throw err;
    } finally {
      setAnalysisLoading(false);
    }
  }

  const clearAnalysis = () => {
    setResult(null);
    setAnalysisError(null);
  };

  return {
    result,
    analysisLoading,
    analysisError,
    runAnalysis,
    clearAnalysis,
  };
}
