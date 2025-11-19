import { useState } from "react";
import { fetchAllNightscoutData } from "./nightscoutApi";
import {
  extractErrorMessage,
  logError,
  validateApiConfiguration,
} from "./validationUtils";

export interface FetchResult {
  entries: any;
  treatments: any;
  profile: any;
  profileHistory: any;
}

/**
 * Simple custom hook for managing Nightscout API data fetching
 */
export function useFetchFromApi() {
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  async function fetchFromApi(
    apiUrl: string,
    token: string,
    days: number
  ): Promise<FetchResult> {
    setError(null);
    setRunning(true);

    try {
      // Validate configuration
      validateApiConfiguration(apiUrl, token);

      const result = await fetchAllNightscoutData(apiUrl, token, days);
      setRunning(false);
      return result;
    } catch (err: any) {
      setRunning(false);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
      logError("Data fetch failed", err);
      throw err;
    }
  }

  const clearData = () => setError(null);

  return { error, running, fetchFromApi, clearData };
}
