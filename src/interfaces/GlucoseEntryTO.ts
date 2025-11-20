/**
 * Single glucose sensor reading (Nightscout / Dexcom-like)
 * - `date` is epoch milliseconds (number)
 * - `dateString` is an ISO timestamp (UTC)
 * - `device` identifies the sensor/device
 * - `direction` is the sensor trend arrow
 * - `sgv` is the sensor glucose value (mg/dL)
 */
export type SensorDirection =
  | "DoubleUp"
  | "SingleUp"
  | "FortyFiveUp"
  | "Flat"
  | "FortyFiveDown"
  | "SingleDown"
  | "DoubleDown"
  | "NotComputable"
  | "RateOutOfRange";

export interface GlucoseEntryTO {
  date: number; // epoch ms, e.g. 1763663424000
  dateString: string; // ISO string, e.g. "2025-11-20T18:30:24.000Z"
  device?: string; // e.g. "Dexcom G7 DX02Dz"
  direction?: SensorDirection; // e.g. "Flat"
  sgv: number; // sensor glucose value (mg/dL)
}
