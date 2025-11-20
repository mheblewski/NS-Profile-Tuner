import { BasalEntry } from "../../interfaces/Profile";
import { SuggestedBasalChange } from "../../interfaces/SuggestedBasalChange";

export function suggestBasalChanges(
  basalProfile: BasalEntry[],
  avgGlucosePerHour: number[],
  targetGlucose: number = 100,
  basalStep: number = 0.05,
  insulinActionHours: number = 4,
  sensitivity: number = 0.2,
  maxDelta: number = 0.05
): SuggestedBasalChange[] {
  const result: SuggestedBasalChange[] = [];

  // Tworzymy pełny profil 24h
  const fullBasal: number[] = [];
  for (let h = 0; h < 24; h++) {
    const existing = basalProfile.find(
      (b) => parseInt(b.time.split(":")[0]) === h
    );
    if (existing) {
      fullBasal[h] = existing.value;
    } else if (h > 0) {
      fullBasal[h] = fullBasal[h - 1];
    } else {
      fullBasal[h] = 0;
    }
  }

  for (let h = 0; h < 24; h++) {
    const oldValue = fullBasal[h];

    // Liczymy wpływ odchylenia glukozy w kolejnych godzinach
    let influence = 0;
    for (let i = 0; i < insulinActionHours; i++) {
      const hourIndex = (h + i) % 24;
      const avg = avgGlucosePerHour[hourIndex] ?? targetGlucose;
      const deviation = avg - targetGlucose;
      influence += deviation / targetGlucose;
    }
    influence /= insulinActionHours;
    influence *= sensitivity;

    // Wyliczamy delta i ograniczamy ją do maxDelta
    let delta = influence * oldValue;
    delta = Math.max(-maxDelta, Math.min(maxDelta, delta));

    // Wyliczamy nową wartość i zaokrąglamy do kroku
    let newValue = oldValue + delta;
    newValue = Math.round(newValue / basalStep) * basalStep;

    // Poprawiamy deltę po zaokrągleniu
    delta = newValue - oldValue;

    // Delta procentowa
    const deltaPercent = oldValue
      ? (delta / oldValue) * 100
      : delta > 0
      ? 100
      : 0;

    result.push({
      time: `${h.toString().padStart(2, "0")}:00`,
      oldValue: parseFloat(oldValue.toFixed(5)),
      newValue: parseFloat(newValue.toFixed(5)),
      delta: parseFloat(delta.toFixed(5)),
      deltaPercent: parseFloat(deltaPercent.toFixed(2)),
    });
  }

  return result;
}
