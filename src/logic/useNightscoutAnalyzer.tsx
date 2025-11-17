import { useFetchFromApi } from "./useFetchFromApi";
import { useAnalysis } from "./useAnalysis";
import { useConfiguration } from "./useConfiguration";

/**
 * Main hook that combines all Nightscout analysis functionality
 */
export function useNightscoutAnalyzer(defaultDays: number = 3) {
  const configuration = useConfiguration(defaultDays);
  const fetch = useFetchFromApi();
  const analysis = useAnalysis();

  async function analyzeAndBuild() {
    if (!configuration.isConfigurationValid()) {
      throw new Error("API URL and token are required");
    }

    try {
      // Fetch data
      const fetchResult = await fetch.fetchFromApi(
        configuration.apiUrl,
        configuration.token,
        configuration.days
      );

      // Run analysis
      const analysisResult = await analysis.runAnalysis(fetchResult);

      return analysisResult;
    } catch (err) {
      console.error("Analysis and build failed:", err);
      throw err;
    }
  }

  const clearAll = () => {
    fetch.clearData();
    analysis.clearAnalysis();
  };

  const isLoading = fetch.running || analysis.analysisLoading;
  const error = fetch.error || analysis.analysisError;

  return {
    // Configuration
    ...configuration,

    // Data and state
    result: analysis.result,
    isLoading,
    error,

    // Actions
    analyzeAndBuild,
    clearAll,

    // Individual hooks (if needed)
    fetch,
    analysis,
  };
}
