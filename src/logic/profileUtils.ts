/**
 * Functions for handling profile parsing and adjustments
 */

export interface ProfileAdjustments {
  newBasal: Array<{
    time: string;
    old: number;
    new: number;
    pct: number;
  }>;
  newICR: Array<{
    time: string;
    old: number;
    new: number;
    pct: number;
    oldUperWW: number;
    newUperWW: number;
  }>;
  newSens: Array<{
    time: string;
    old: number;
    new: number;
    pct: number;
  }>;
}

/**
 * Rounds basal value to nearest step
 */
export function roundBasal(value: number, step: number = 0.05): number {
  return Math.round(value / step) * step;
}

/**
 * Expands basal array to 24 explicit hours
 */
export function expandTo24Hours(
  basalArray: any[]
): Array<{ time: string; value: number }> {
  // Convert to hourly map: hour → value
  const hourly = Array.from({ length: 24 }, () => null as number | null);

  basalArray.forEach((b) => {
    const [h] = (b.time || b.start).split(":");
    hourly[Number(h)] = Number(b.value || b.rate);
  });

  // Forward fill empty hours with last known value
  let last = hourly[0] != null ? hourly[0] : 0;

  for (let i = 0; i < 24; i++) {
    if (hourly[i] == null) hourly[i] = last;
    else last = hourly[i] as number;
  }

  return hourly.map((v, h) => ({
    time: String(h).padStart(2, "0") + ":00",
    value: v as number,
  }));
}

/**
 * Parses Loop/Nightscout profile JSON format
 */
export function parseLoopProfile(profileJson: any) {
  if (!profileJson) return null;

  const arr = Array.isArray(profileJson) ? profileJson : [profileJson];
  if (!arr.length) return null;

  const latest = arr[0];
  const defaultProfile = latest.defaultProfile || "Default";
  const store =
    latest.store && latest.store[defaultProfile]
      ? latest.store[defaultProfile]
      : latest.store || null;
  if (!store) return null;

  const basal = (store.basal || []).map((b: any) => ({
    time: b.time || b.start,
    seconds: b.timeAsSeconds,
    value: Number(b.value),
  }));

  const icr = (store.carbratio || []).map((c: any) => ({
    time: c.time,
    seconds: c.timeAsSeconds,
    value: Number(c.value),
  }));

  const sens = (store.sens || []).map((s: any) => ({
    time: s.time,
    seconds: s.timeAsSeconds,
    value: Number(s.value),
  }));

  return { basal, icr, sens };
}

/**
 * Applies percentage adjustments to a profile
 */
export function applyAdjustmentsToProfile(
  profileObj: any,
  basalAdjPct: number[],
  icrPct: number,
  isfPct: number,
  basalStep: number = 0.05
): ProfileAdjustments {
  let newBasal: { time: string; old: number; new: number; pct: number }[] = [];
  if (
    profileObj?.basal &&
    Array.isArray(profileObj.basal) &&
    profileObj.basal.length > 0
  ) {
    const curBasalRaw = profileObj.basal.map((b: any) => ({
      time: b.time || b.start,
      value: Number(b.value || b.rate),
    }));

    // Expand to 24 hours
    const curBasal = expandTo24Hours(curBasalRaw);

    newBasal = curBasal.map((b, i) => {
      const pct = basalAdjPct[i] || 0;
      const newVal = roundBasal(b.value * (1 + pct / 100), basalStep);
      return { time: b.time, old: b.value, new: newVal, pct };
    });
  }

  let newICR: {
    time: any;
    old: number;
    new: number;
    pct: number;
    oldUperWW: number;
    newUperWW: number;
  }[] = [];
  if (
    profileObj?.icr &&
    Array.isArray(profileObj.icr) &&
    profileObj.icr.length > 0
  ) {
    const curICR = profileObj.icr.map((c: any) => ({
      time: c.time || c.start,
      value: Number(c.value),
    }));

    newICR = curICR.map((c: any) => {
      const oldVal = Number(c.value);
      const newVal = Number((oldVal * (1 - icrPct / 100)).toFixed(2));

      return {
        time: c.time,
        old: oldVal,
        new: newVal,
        pct: icrPct,
        oldUperWW: Number((10 / oldVal).toFixed(2)),
        newUperWW: Number((10 / newVal).toFixed(2)),
      };
    });
  }

  let newSens: { time: any; old: number; new: number; pct: number }[] = [];
  if (
    (profileObj?.sens &&
      Array.isArray(profileObj.sens) &&
      profileObj.sens.length > 0) ||
    (profileObj?.sensitivity &&
      Array.isArray(profileObj.sensitivity) &&
      profileObj.sensitivity.length > 0)
  ) {
    const sensSource = profileObj?.sens || profileObj?.sensitivity;

    newSens = sensSource.map((s: any) => {
      const oldVal = Number(s.value || s.sensitivity);
      return {
        time: s.time || s.start,
        old: oldVal,
        new: Number((oldVal * (1 - isfPct / 100)).toFixed(1)),
        pct: isfPct,
      };
    });
  }

  return {
    newBasal,
    newICR,
    newSens,
  };
}
