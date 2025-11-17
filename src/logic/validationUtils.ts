/**
 * Utility functions for error handling and state management
 */

/**
 * Extracts error message from various error types
 */
export function extractErrorMessage(err: any): string {
  if (err?.message) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return String(err);
}

/**
 * Logs error with context information
 */
export function logError(context: string, err: any): void {
  console.error(`${context}:`, err);
}

/**
 * Validates analysis data completeness
 */
export function validateAnalysisData(data: {
  entries: any;
  treatments: any;
  profile: any;
}): void {
  if (!data.entries || !Array.isArray(data.entries)) {
    throw new Error("Invalid or missing entries data");
  }
  if (!data.treatments || !Array.isArray(data.treatments)) {
    throw new Error("Invalid or missing treatments data");
  }
  // Profile is optional, so we don't validate it
}

/**
 * Validates API configuration
 */
export function validateApiConfiguration(apiUrl: string, token: string): void {
  if (!apiUrl || apiUrl.trim() === "") {
    throw new Error("API URL is required");
  }
  if (!token || token.trim() === "") {
    throw new Error("API token is required");
  }

  // Basic URL format validation
  try {
    new URL(apiUrl);
  } catch {
    throw new Error("API URL must be a valid URL");
  }
}
