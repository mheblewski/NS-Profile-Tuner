export interface Profile {
  startDate: Date;
  basal: BasalEntry[];
  carbRatio: CarbRatioEntry[];
  sensitivity: SensitivityEntry[];
  target: TargetRangeEntry[];
  dia: number;
  timezone: string;
}

export interface BasalEntry {
  time: string; // np. "14:00"
  timeAsSeconds?: number;
  value: number; // U/h
}

export interface CarbRatioEntry {
  time: string;
  timeAsSeconds: number;
  value: number; // g/U
}

export interface SensitivityEntry {
  time: string;
  timeAsSeconds: number;
  value: number; // mg/dL per U
}

export interface TargetRangeEntry {
  time: string;
  timeAsSeconds: number;
  low: number; // mg/dL
  high: number; // mg/dL
}
