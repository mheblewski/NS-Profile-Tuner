// import { BasalEntry } from "../interfaces/Profile";

import {
  BasalEntry,
  CarbRatioEntry,
  Profile,
  SensitivityEntry,
} from "../interfaces/Profile";

export interface ProfileChangeResult {
  day: string;
  type: "basal" | "icr" | "isf";
  curr: {
    basal: BasalEntry[];
    icr: CarbRatioEntry[];
    isf: SensitivityEntry[];
  };
  prev: {
    basal: BasalEntry[];
    icr: CarbRatioEntry[];
    isf: SensitivityEntry[];
  };
}

export class ProfileChangeDetector {
  constructor(private profiles: Profile[], private days?: number) {}

  public detectChanges(): ProfileChangeResult[] {
    const results: ProfileChangeResult[] = [];
    const now = new Date();

    // Grupowanie profili po dniu
    const profilesByDay = this.groupByDay(this.profiles);

    const sortedDays = Object.keys(profilesByDay).sort();

    for (let i = 1; i < sortedDays.length; i++) {
      const day = sortedDays[i];
      const prevDay = sortedDays[i - 1];

      const currProfiles = profilesByDay[day];
      const prevProfiles = profilesByDay[prevDay];

      if (this.days && this.daysAgo(new Date(day), now) > this.days) {
        continue;
      }

      const curr = currProfiles[currProfiles.length - 1]; // ostatni wpis dnia
      const prev = prevProfiles[prevProfiles.length - 1]; // ostatni wpis dnia poprzedniego

      if (this.hasBasalChanged(prev, curr)) {
        results.push(this.buildResult(curr, prev, "basal"));
      }
      if (this.hasICRChanged(prev, curr)) {
        results.push(this.buildResult(curr, prev, "icr"));
      }
      if (this.hasISFChanged(prev, curr)) {
        results.push(this.buildResult(curr, prev, "isf"));
      }
    }

    return results;
  }

  private groupByDay(profiles: Profile[]): Record<string, Profile[]> {
    return profiles.reduce((acc, p) => {
      const day = p.startDate.toISOString().slice(0, 10);
      if (!acc[day]) acc[day] = [];
      acc[day].push(p);
      return acc;
    }, {} as Record<string, Profile[]>);
  }

  private daysAgo(date: Date, now: Date): number {
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }

  private hasBasalChanged(prev: Profile, curr: Profile): boolean {
    return !this.arrayEquals(
      prev.basal,
      curr.basal,
      (a, b) => a.time === b.time && a.value === b.value
    );
  }

  private hasICRChanged(prev: Profile, curr: Profile): boolean {
    return !this.arrayEquals(
      prev.carbRatio,
      curr.carbRatio,
      (a, b) => a.time === b.time && a.value === b.value
    );
  }

  private hasISFChanged(prev: Profile, curr: Profile): boolean {
    return !this.arrayEquals(
      prev.sensitivity,
      curr.sensitivity,
      (a, b) => a.time === b.time && a.value === b.value
    );
  }

  private buildResult(
    curr: Profile,
    prev: Profile,
    type: "basal" | "icr" | "isf"
  ): ProfileChangeResult {
    return {
      day: curr.startDate.toISOString().slice(0, 10),
      type,
      curr: {
        basal: curr.basal,
        icr: curr.carbRatio,
        isf: curr.sensitivity,
      },
      prev: {
        basal: prev.basal,
        icr: prev.carbRatio,
        isf: prev.sensitivity,
      },
    };
  }

  private arrayEquals<T>(
    a: T[],
    b: T[],
    comparator: (a: T, b: T) => boolean
  ): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!comparator(a[i], b[i])) return false;
    }
    return true;
  }
}
