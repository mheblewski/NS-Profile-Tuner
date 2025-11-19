import React, { useState, useEffect } from "react";

/**
 * Component for displaying ISF analysis with separate tables for modifications and new slots
 */
export default function ISFComparisonTable({ isfData, isfStructuredData }) {
  const [showUnchanged, setShowUnchanged] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(min-width: 768px)").matches;
    }
    return false;
  });
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => {
      setShowUnchanged(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  // Use structured data if available for separate display
  const hasStructuredData =
    isfStructuredData &&
    (isfStructuredData.modifications?.length > 0 ||
      isfStructuredData.newSlots?.length > 0 ||
      (Array.isArray(isfStructuredData.newSlots) &&
        isfStructuredData.newSlots.length > 0));

  if (!hasStructuredData && (!isfData || isfData.length === 0)) {
    return (
      <section className="p-4 border bg-white rounded-xl shadow-lg">
        <h3 className="font-semibold mb-2">Profil ISF</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  // Render two separate tables
  if (hasStructuredData) {
    return (
      <div className="space-y-6">
        {/* Table 1: All existing profile slots */}
        {(isfStructuredData.modifications?.length > 0 ||
          isfStructuredData.profileCompliant?.length > 0) && (
          <section className="p-4 border bg-white rounded-xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
              <h3 className="font-semibold mb-2 md:mb-0 flex items-center">
                Profil ISF
              </h3>
              <button
                className="text-xs px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700"
                onClick={() => setShowUnchanged((v) => !v)}
              >
                {showUnchanged
                  ? "Ukryj sloty bez zmiany"
                  : "Pokaż wszystkie sloty"}
              </button>
            </div>
            {/* Mobile: karty */}
            <div className="flex flex-col gap-1 md:hidden">
              {[
                ...(isfStructuredData.profileCompliant || []),
                ...(isfStructuredData.modifications || []),
              ]
                .sort((a, b) => a.hour - b.hour)
                .filter((s) => showUnchanged || !s.isProfileCompliant)
                .map((s, i) => {
                  const isChanged = !s.isProfileCompliant;
                  const delta = `${s.adjustmentPct > 0 ? "+" : ""}${
                    s.adjustmentPct
                  }%`;
                  return (
                    <div
                      key={i}
                      className={`relative border rounded-md px-6 py-2 bg-white ${
                        isChanged
                          ? "ring-1 ring-yellow-300 bg-yellow-50"
                          : "ring-1 ring-gray-200"
                      }`}
                    >
                      {/* Linia 1: godzina + tag z nową wartością */}
                      <div className="flex items-center gap-2 mb-0.5 min-h-[32px]">
                        <span className="text-[16px] font-bold text-gray-800 tracking-wide">
                          {String(s.hour).padStart(2, "0")}:00
                        </span>
                        {isChanged && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[9px] font-semibold uppercase">
                            Zmiana
                          </span>
                        )}
                        <span className="ml-auto flex items-center h-full absolute right-4 top-1/2 -translate-y-1/2">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                            {s.adjustmentPct > 0 ? "+" : ""}
                            {s.adjustmentPct}%
                          </span>
                        </span>
                      </div>
                      <style jsx>{`
                        @media (max-width: 767px) {
                          .relative-card {
                            position: relative;
                          }
                        }
                      `}</style>
                      {/* Linia 2: stara wartość → nowa wartość (+delta) */}
                      <div className="text-[15px] text-gray-700 mt-0.5 flex items-center gap-2">
                        <span>
                          {s.currentISF}{" "}
                          <span className="text-gray-400 text-[13px]">
                            mg/dL/U
                          </span>
                        </span>
                        <span className="text-gray-400 text-[18px]">→</span>
                        <span className="font-bold text-blue-900">
                          {s.suggestedISF}
                        </span>{" "}
                        <span className="text-gray-400 text-[13px]">
                          mg/dL/U
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
            {/* Desktop: tabela */}
            <table className="w-full min-w-[420px] rounded-xl overflow-hidden shadow border text-[15px] hidden md:table">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Godzina
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Aktualne (mg/dL/U)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Sugerowane (mg/dL/U)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...(isfStructuredData.profileCompliant || []),
                  ...(isfStructuredData.modifications || []),
                ]
                  .sort((a, b) => a.hour - b.hour)
                  .filter((s) => showUnchanged || !s.isProfileCompliant)
                  .map((s, i) => (
                    <tr
                      key={i}
                      className={`transition-colors duration-150 border-b hover:bg-gray-100 ${
                        s.isProfileCompliant
                          ? "bg-white"
                          : "bg-yellow-50 hover:bg-yellow-100"
                      }`}
                    >
                      <td className="px-3 py-2 border-b text-center text-[15px] font-bold text-gray-800">
                        {String(s.hour).padStart(2, "0")}:00
                      </td>
                      <td className="px-3 py-2 border-b text-center text-gray-700">
                        {s.currentISF}
                      </td>
                      <td className="px-3 py-2 border-b text-center text-blue-900 font-semibold">
                        {s.suggestedISF}
                      </td>
                      <td className="px-3 py-2 border-b text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold">
                          {s.adjustmentPct > 0 ? "+" : ""}
                          {s.adjustmentPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Table 2: New slots to add */}
        {isfStructuredData.newSlots?.length > 0 && (
          <section className="p-4 border bg-white rounded-xl shadow-lg">
            <h3 className="font-semibold mb-2">
              ✨ Profil ISF - Nowe sloty do dodania
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Sugerowane time sloty które należy dodać do profilu
            </p>
            <table className="w-full min-w-[420px] rounded-xl overflow-hidden shadow border text-[15px] hidden md:table">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-center">Godzina</th>
                  <th className="p-2 text-center">Aktualne (mg/dL/U)</th>
                  <th className="p-2 text-center">Sugerowane (mg/dL/U)</th>
                  <th className="p-2 text-center">Δ</th>
                </tr>
              </thead>
              <tbody>
                {isfStructuredData.newSlots
                  .sort((a, b) => a.hour - b.hour)
                  .map((s, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-100 transition-colors duration-150 bg-slate-50"
                    >
                      <td className="p-2 text-center">
                        {String(s.hour).padStart(2, "0")}:00
                        {s.isGroupedRecommendation && s.affectedHours && (
                          <div className="text-xs text-gray-600 mt-1">
                            Wpływa na:{" "}
                            {s.affectedHours
                              .map((h) => `${h.toString().padStart(2, "0")}:00`)
                              .join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">{s.currentISF}</td>
                      <td className="p-2 text-center font-medium">
                        {s.suggestedISF}
                      </td>
                      <td className="p-2 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold">
                          {s.adjustmentPct > 0 ? "+" : ""}
                          {s.adjustmentPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    );
  }

  // Fallback to single table for backward compatibility
  return (
    <section className="p-4 border bg-white rounded-xl shadow-lg">
      <h3 className="font-semibold mb-2">Profil ISF</h3>
      {/* Toggle for unchanged slots */}
      <div className="mb-2 md:hidden">
        <button
          className="text-xs px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700"
          onClick={() => setShowUnchanged((v) => !v)}
        >
          {showUnchanged ? "Ukryj sloty bez zmiany" : "Pokaż wszystkie sloty"}
        </button>
      </div>
      {/* Mobile: karty */}
      <div className="flex flex-col gap-1 md:hidden">
        {isfData
          ?.filter((s) => showUnchanged || s.pct !== 0)
          .map((s, i) => {
            return (
              <div
                key={i}
                className={`relative border rounded-md px-6 py-2 bg-white ${
                  s.pct !== 0
                    ? "ring-1 ring-yellow-300 bg-yellow-50"
                    : "ring-1 ring-gray-200"
                }`}
              >
                {/* Linia 1: godzina + tag z nową wartością */}
                <div className="flex items-center gap-2 mb-0.5 min-h-[32px]">
                  <span className="text-[16px] font-bold text-gray-800 tracking-wide">
                    {s.time}
                  </span>
                  {s.pct !== 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[9px] font-semibold uppercase">
                      Zmiana
                    </span>
                  )}
                  <span className="ml-auto flex items-center h-full absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                      {s.pct > 0 ? "+" : ""}
                      {s.pct}%
                    </span>
                  </span>
                </div>
                <style jsx>{`
                  @media (max-width: 767px) {
                    .relative-card {
                      position: relative;
                    }
                  }
                `}</style>
                {/* Linia 2: stara wartość → nowa wartość */}
                <div className="text-[15px] text-gray-700 mt-0.5 flex items-center gap-2">
                  <span>
                    {s.old}{" "}
                    <span className="text-gray-400 text-[13px]">mg/dL/U</span>
                  </span>
                  <span className="text-gray-400 text-[18px]">→</span>
                  <span className="font-bold text-blue-900">{s.new}</span>{" "}
                  <span className="text-gray-400 text-[13px]">mg/dL/U</span>
                </div>
              </div>
            );
          })}
      </div>
      {/* Desktop: tabela */}
      <table className="w-full min-w-[420px] rounded-xl overflow-hidden shadow border text-[15px] hidden md:table">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 border-b text-center font-semibold">
              Godzina
            </th>
            <th className="px-3 py-2 border-b text-center font-semibold">
              Aktualne (mg/dL/U)
            </th>
            <th className="px-3 py-2 border-b text-center font-semibold">
              Sugerowane (mg/dL/U)
            </th>
            <th className="px-3 py-2 border-b text-center font-semibold">Δ</th>
          </tr>
        </thead>
        <tbody>
          {isfData?.map((s, i) => (
            <tr key={i} className="bg-white transition-colors duration-150">
              <td className="px-3 py-2 border-b text-center text-[15px] font-bold text-gray-800">
                {s.time}
              </td>
              <td className="px-3 py-2 border-b text-center text-gray-700">
                {s.old}
              </td>
              <td className="px-3 py-2 border-b text-center text-blue-900 font-semibold">
                {s.new}
              </td>
              <td className="px-3 py-2 border-b text-center">
                <span className="inline-block px-2 py-0.5 rounded-full font-bold text-base bg-gray-100 text-gray-700">
                  {s.pct > 0 ? "+" : ""}
                  {s.pct}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
