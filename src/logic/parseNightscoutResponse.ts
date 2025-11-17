// Data type for a single Nightscout entry
interface NightscoutEntry {
  dateString: string;
  date: number;
  sgv: number;
  direction: string;
  device: string;
}

/**
 * Checks if text looks like JSON and attempts to parse it
 */
function tryParseJson(text: string): any {
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error("Failed to parse JSON: " + errorMessage);
  }
}

/**
 * Parses a line in Nightscout CSV format using main regex
 * Format: "ISO" epoch BG "trend" "device"
 */
function parseMainCsvFormat(line: string): NightscoutEntry | null {
  const regex = /^"([^"]+)"\s+([\d.]+)\s+(\d+)\s+"([^"]+)"\s+"([^"]+)"\s*$/;
  const match = line.match(regex);

  if (!match) return null;

  const [, iso, epochStr, sgvStr, direction, device] = match;
  const epoch = Number(epochStr);
  const sgv = Number(sgvStr);

  return {
    dateString: iso,
    date: Date.parse(iso) || Math.round(epoch),
    sgv,
    direction,
    device,
  };
}

/**
 * Fallback parser for lines that don't match the main format
 * Attempts to extract data from less structured lines
 */
function parseFallbackCsvFormat(line: string): NightscoutEntry | null {
  const parts = line
    .split('"')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  const iso = parts[0].replace(/^\s+|\s+$/g, "");
  const rest = parts[1].trim().split(/\s+/);
  const epoch = rest[0] ? Number(rest[0]) : Date.parse(iso);
  const sgv = rest[1] ? Number(rest[1]) : null;
  const direction = parts[2] || "";
  const device = parts[3] || "";

  if (!iso || sgv == null) return null;

  return {
    dateString: iso,
    date: Date.parse(iso) || epoch,
    sgv: Number(sgv),
    direction,
    device,
  };
}

/**
 * Parses CSV-like Nightscout data line by line
 */
function parseCsvLikeData(text: string): NightscoutEntry[] {
  const lines = text.split(/\r?\n/);
  const results: NightscoutEntry[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // First try main format
    const mainResult = parseMainCsvFormat(trimmedLine);
    if (mainResult) {
      results.push(mainResult);
      continue;
    }

    // If that doesn't work, use fallback
    const fallbackResult = parseFallbackCsvFormat(trimmedLine);
    if (fallbackResult) {
      results.push(fallbackResult);
    }
  }

  return results;
}

/**
 * AUTOPARSER: detects JSON or CSV-like Nightscout (line: "ISO" epoch BG "trend" "device")
 * Main function for parsing Nightscout responses
 */
export function parseNightscoutResponse(raw: string): any {
  if (typeof raw !== "string") return raw;

  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Check if it's JSON
  const jsonResult = tryParseJson(trimmed);
  if (jsonResult !== null) {
    return jsonResult;
  }

  // If not JSON, parse as CSV-like
  return parseCsvLikeData(trimmed);
}
