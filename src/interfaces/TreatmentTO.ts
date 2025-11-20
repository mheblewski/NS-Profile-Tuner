export type TreatmentEventType =
  | "Temp Basal"
  | "Correction Bolus"
  | "Bolus"
  | "Carb Correction"
  | "Site Change"
  | "Meal Bolus"
  | "BG Check"
  | string; // fallback for other types

export interface TreatmentTO {
  absolute: number;
  amount: number;
  automatic: boolean;
  carbs: number | null;
  created_at: string;
  duration: number;
  enteredBy: string;
  eventType: TreatmentEventType;
  insulin: number | null;
  insulinType: string;
  rate: number;
  syncIdentifier: string;
  temp: string;
  timestamp: string;
  utcOffset: number;
  _id: string;
}
