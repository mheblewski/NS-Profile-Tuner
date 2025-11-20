import { useFetchFromApi } from "./useFetchFromApi";
import { useAnalysis } from "./useAnalysis";
import { useConfiguration } from "./useConfiguration";
import { format } from "./dataFormat";
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
      // Convert string values to numbers if needed
      const daysNum =
        typeof configuration.days === "string"
          ? Number(configuration.days)
          : configuration.days;
      const basalStepNum =
        typeof configuration.basalStep === "string"
          ? Number(configuration.basalStep)
          : configuration.basalStep;

      // Fetch data
      const fetchResult = await fetch.fetchFromApi(
        configuration.apiUrl,
        configuration.token,
        daysNum
      );

      const {
        glucoseEntries,
        treatmentEntries,
        profileEntries,
        profileHistoryEntries,
      } = format(fetchResult);

      // Run analysis na przetworzonych danych (z Date)
      const analysisResult = await analysis.runAnalysis({
        entries: glucoseEntries,
        treatments: treatmentEntries,
        profile: profileEntries[0],
        profileHistory: profileHistoryEntries,
        basalStep: basalStepNum,
        days: daysNum,
      });

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
