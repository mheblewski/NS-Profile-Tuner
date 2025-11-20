export type TreatmentEventType =
  | "Bolus"
  | "Carbs"
  | "Correction Bolus"
  | "Temp Basal"
  | "Profile Switch";

export interface Treatment {
  date: Date;
  type: TreatmentEventType;
  insulin?: number;
  carbs?: number;
  duration?: number; // min dla tempBasal
  rate?: number; // U/h dla tempBasal
}
