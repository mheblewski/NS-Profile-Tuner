import { useState } from "react";
import { validateApiConfiguration } from "./validationUtils";

export interface Configuration {
  apiUrl: string;
  token: string;
  days: number;
}

/**
 * Validates configuration completeness
 */
function isConfigurationComplete(apiUrl: string, token: string): boolean {
  return apiUrl.trim() !== "" && token.trim() !== "";
}

/**
 * Validates configuration format and values
 */
function validateConfiguration(config: Configuration): string[] {
  const errors: string[] = [];

  if (!config.apiUrl.trim()) {
    errors.push("API URL is required");
  } else {
    try {
      new URL(config.apiUrl);
    } catch {
      errors.push("API URL must be a valid URL");
    }
  }

  if (!config.token.trim()) {
    errors.push("API token is required");
  }

  if (config.days < 1 || config.days > 30) {
    errors.push("Days must be between 1 and 30");
  }

  return errors;
}

/**
 * Custom hook for managing application configuration
 */
export function useConfiguration(defaultDays: number = 3) {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [days, setDays] = useState(defaultDays);

  const configuration: Configuration = {
    apiUrl,
    token,
    days,
  };

  const isConfigurationValid = (): boolean => {
    return isConfigurationComplete(apiUrl, token);
  };

  const getConfigurationErrors = (): string[] => {
    return validateConfiguration(configuration);
  };

  const canSubmit = (): boolean => {
    return isConfigurationValid() && getConfigurationErrors().length === 0;
  };

  const resetConfiguration = (): void => {
    setApiUrl("");
    setToken("");
    setDays(defaultDays);
  };

  const validateAndThrow = (): void => {
    validateApiConfiguration(apiUrl, token);
  };

  return {
    configuration,
    apiUrl,
    setApiUrl,
    token,
    setToken,
    days,
    setDays,
    isConfigurationValid,
    getConfigurationErrors,
    canSubmit,
    resetConfiguration,
    validateAndThrow,
  };
}
