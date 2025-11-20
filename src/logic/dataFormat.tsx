import { useState } from "react";
import { GlucoseEntry } from "../interfaces/GlucoseEntry";
import { FetchResult } from "./useFetchFromApi";
import { GlucoseEntryTO } from "../interfaces/GlucoseEntryTO";
import { TreatmentTO } from "../interfaces/TreatmentTO";
import { Treatment } from "../interfaces/Treatment";
import { ProfileTO } from "../interfaces/ProfileTO";
import { Profile } from "../interfaces/Profile";

export function format(fetchResult: FetchResult) {
  return {
    glucoseEntries: formatGlucoseEntries(fetchResult.entries),
    treatmentEntries: formatTreatmentEntries(fetchResult.treatments),
    profileEntries: formatProfileEntries(fetchResult.profile),
    profileHistoryEntries: formatProfileEntries(fetchResult.profileHistory),
  };
}

function formatGlucoseEntries(
  GlucoseEntryTOs: GlucoseEntryTO[]
): GlucoseEntry[] {
  return GlucoseEntryTOs.map((e) => ({
    date: typeof e.dateString === 'string' && e.dateString.endsWith('Z')
      ? new Date(e.dateString.replace(/Z$/, ''))
      : new Date(e.dateString),
    value: e.sgv,
  }));
}

function formatTreatmentEntries(treatmentTOs: TreatmentTO[]): Treatment[] {
  return treatmentTOs.map((t) => ({
    date: new Date(
      typeof t.created_at === 'string' && t.created_at.endsWith('Z')
        ? t.created_at.replace(/Z$/, '')
        : t.created_at
    ),
    type: t.eventType as Treatment["type"],
    insulin: t.insulin ?? undefined,
    carbs: t.carbs ?? undefined,
    duration: t.duration,
    rate: t.rate,
  }));
}

function formatProfileEntries(profileTOs: ProfileTO[]): Profile[] {
  return profileTOs.map((p) => ({
    startDate: new Date(
      typeof p.startDate === 'string' && p.startDate.endsWith('Z')
        ? p.startDate.replace(/Z$/, '')
        : p.startDate
    ),
    basal: p.store.Default.basal.map((b) => ({
      time: b.time,
      timeAsSeconds: b.timeAsSeconds,
      value: b.value,
    })),
    carbRatio: p.store.Default.carbratio.map((c) => ({
      time: c.time,
      timeAsSeconds: c.timeAsSeconds,
      value: c.value,
    })),
    sensitivity: p.store.Default.sens.map((s) => ({
      time: s.time,
      timeAsSeconds: s.timeAsSeconds,
      value: s.value,
    })),
    target: p.store.Default.target_low.map((tLow) => {
      const matchingHigh = p.store.Default.target_high.find(
        (tHigh) => tHigh.time === tLow.time
      );
      return {
        time: tLow.time,
        timeAsSeconds: tLow.timeAsSeconds,
        low: tLow.value,
        high: matchingHigh ? matchingHigh.value : tLow.value,
      };
    }),
    dia: p.store.Default.dia,
    timezone: p.store.Default.timezone,
  }));
}
