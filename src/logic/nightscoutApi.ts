import { parseNightscoutResponse } from "./parseNightscoutResponse";

/**
 * Utility functions for Nightscout API operations
 */

/**
 * Builds the base URL without trailing slashes
 */
export function buildBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

/**
 * Calculates the 'since' date for the API query
 */
export function calculateSinceDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Builds query parameters for entries endpoint
 */
export function buildEntriesParams(
  token: string,
  since: string
): URLSearchParams {
  return new URLSearchParams({
    token: token || "",
    count: "1000",
    "find[dateString][$gte]": since,
  });
}

/**
 * Builds query parameters for treatments endpoint
 */
export function buildTreatmentsParams(
  token: string,
  since: string
): URLSearchParams {
  return new URLSearchParams({
    token: token || "",
    count: "1000",
    "find[created_at][$gte]": since,
  });
}

/**
 * Fetches entries data from Nightscout API
 */
export async function fetchEntries(
  baseUrl: string,
  params: URLSearchParams
): Promise<any> {
  const response = await fetch(`${baseUrl}/api/v1/entries?${params}`, {
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Entries API error ${response.status}`);
  }

  const rawData = await response.text();
  return parseNightscoutResponse(rawData);
}

/**
 * Fetches treatments data from Nightscout API
 */
export async function fetchTreatments(
  baseUrl: string,
  params: URLSearchParams
): Promise<any> {
  const response = await fetch(`${baseUrl}/api/v1/treatments?${params}`, {
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Treatments API error ${response.status}`);
  }

  const rawData = await response.text();
  return parseNightscoutResponse(rawData);
}

/**
 * Fetches profile data from Nightscout API (optional, won't throw on failure)
 */
export async function fetchProfile(
  baseUrl: string,
  token: string
): Promise<any | null> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/profile?token=${encodeURIComponent(token || "")}`,
      { credentials: "omit" }
    );

    if (!response.ok) {
      return null;
    }

    const rawData = await response.text();
    return parseNightscoutResponse(rawData);
  } catch (e) {
    console.warn("Profile fetch failed:", e);
    return null;
  }
}

/**
 * Orchestrates fetching all Nightscout data
 */
export async function fetchAllNightscoutData(
  apiUrl: string,
  token: string,
  days: number
): Promise<{ entries: any; treatments: any; profile: any | null }> {
  const baseUrl = buildBaseUrl(apiUrl);
  const since = calculateSinceDate(days);

  // Build parameters
  const entriesParams = buildEntriesParams(token, since);
  const treatmentsParams = buildTreatmentsParams(token, since);

  // Fetch entries and treatments in parallel
  const [entries, treatments] = await Promise.all([
    fetchEntries(baseUrl, entriesParams),
    fetchTreatments(baseUrl, treatmentsParams),
  ]);

  // Fetch profile separately (optional)
  const profile = await fetchProfile(baseUrl, token);

  return { entries, treatments, profile };
}
