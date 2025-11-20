export interface ProfileTO {
  defaultProfile: string;
  enteredBy: string;
  loopSettings?: LoopSettings;
  store: Store;
  units: string;
  mills: string;
  startDate: string;
}

export interface LoopSettings {
  overridePresets: OverridePresetTO[];
  bundleIdentifier?: string;
  deviceToken?: string;
  dosingEnabled?: boolean;
  dosingStrategy?: string;
  maximumBasalRatePerHour?: number;
  maximumBolus?: number;
  minimumBGGuard?: number;
  preMealTargetRange?: number[];
}

export interface Store {
  Default: {
    basal: BasalEntryTO[];
    carbratio: CarbRatioEntryTO[];
    carbs_hr: string;
    delay: string;
    dia: number;
    sens: SensitivityEntryTO[];
    target_high: TargetEntryTO[];
    target_low: TargetEntryTO[];
    timezone: string;
    units: string;
  };
}

export interface BasalEntryTO {
  time: string;
  value: number;
  timeAsSeconds: number;
}

export interface CarbRatioEntryTO {
  time: string;
  value: number;
  timeAsSeconds: number;
}

export interface SensitivityEntryTO {
  time: string;
  value: number;
  timeAsSeconds: number;
}

export interface TargetEntryTO {
  time: string;
  value: number;
  timeAsSeconds: number;
}

export interface OverridePresetTO {
  duration: number;
  insulinNeedsScaleFactor: number;
  name: string;
  symbol: string;
}
