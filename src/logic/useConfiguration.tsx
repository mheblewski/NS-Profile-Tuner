import { useState } from "react";
import { validateApiConfiguration } from "./validationUtils";

export interface Configuration {
  apiUrl: string;
  token: string;
  days: number | string;
  basalStep: number | string;
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

  const daysNum =
    typeof config.days === "string" ? Number(config.days) : config.days;
  const basalStepNum =
    typeof config.basalStep === "string"
      ? Number(config.basalStep)
      : config.basalStep;

  if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
    errors.push("Days must be between 1 and 30");
  }

  if (isNaN(basalStepNum) || basalStepNum <= 0 || basalStepNum > 1) {
    errors.push("Basal step must be between 0.001 and 1.0");
  }

  return errors;
}

/**
 * Custom hook for managing application configuration
 */
export function useConfiguration(defaultDays: number = 3) {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [days, setDays] = useState<number | string>(defaultDays);
  const [basalStep, setBasalStep] = useState<number | string>(0.05);

  const configuration: Configuration = {
    apiUrl,
    token,
    days,
    basalStep,
  };

  const isConfigurationValid = (): boolean => {
    return isConfigurationComplete(apiUrl, token);
  };

  const getConfigurationErrors = (): string[] => {
    return validateConfiguration(configuration);
  };

  const canSubmit = (): boolean => {
    // Simplified validation - just check if required fields are not empty
    const hasApiUrl = apiUrl.trim() !== "";
    const hasToken = token.trim() !== "";
    const daysNum =
      typeof days === "string" ? (days === "" ? 0 : Number(days)) : days;
    const basalStepNum =
      typeof basalStep === "string"
        ? basalStep === ""
          ? 0
          : Number(basalStep)
        : basalStep;
    const validDays = daysNum >= 1 && daysNum <= 30;
    const validBasalStep = basalStepNum > 0 && basalStepNum <= 1;

    return hasApiUrl && hasToken && validDays && validBasalStep;
  };

  const resetConfiguration = (): void => {
    setApiUrl("");
    setToken("");
    setDays(defaultDays);
    setBasalStep(0.05);
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
    basalStep,
    setBasalStep,
    isConfigurationValid,
    getConfigurationErrors,
    canSubmit,
    resetConfiguration,
    validateAndThrow,
  };
}
