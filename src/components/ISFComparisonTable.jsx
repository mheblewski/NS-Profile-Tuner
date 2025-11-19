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

  // Main table: profileCompliant + modifications
  const displayData = hasStructuredData
    ? [
        ...(isfStructuredData?.profileCompliant || []),
        ...(isfStructuredData?.modifications || []),
      ]
        .sort((a, b) => a.hour - b.hour)
        .filter((s) => showUnchanged || !s.isProfileCompliant)
    : isfData || [];

  // New slots table
  const newSlotsData = hasStructuredData
    ? (isfStructuredData?.newSlots || []).sort((a, b) => a.hour - b.hour)
    : [];

  if (
    (!displayData || displayData.length === 0) &&
    (!newSlotsData || newSlotsData.length === 0)
  ) {
    return (
      <section className="p-4 border bg-white rounded-xl shadow-lg">
        <h3 className="font-semibold mb-2">Profil ISF</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  // Czy są sloty profileCompliant do ukrywania/pokazywania?
  const canToggleProfileCompliant =
    hasStructuredData && (isfStructuredData?.profileCompliant?.length || 0) > 0;

  return (
    <section className="p-4 border bg-white rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Profil ISF</h3>
        {canToggleProfileCompliant && (
          <button
            className={
              "ml-2 px-3 py-1 rounded font-semibold text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }
            onClick={() => setShowUnchanged((v) => !v)}
          >
            {showUnchanged ? "Ukryj sloty bez zmian" : "Pokaż wszystkie sloty"}
          </button>
        )}
      </div>
      {/* Main ISF table/cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {displayData.map((s, i) => {
          const hour =
            s.time ||
            (s.hour !== undefined
              ? String(s.hour).padStart(2, "0") + ":00"
              : "");
          const current = s.currentISF !== undefined ? s.currentISF : s.old;
          const suggested =
            s.suggestedISF !== undefined ? s.suggestedISF : s.new;
          const pct =
            current && suggested
              ? Math.round(((suggested - current) / current) * 100)
              : s.adjustmentPct !== undefined
              ? s.adjustmentPct
              : s.pct;
          const changed = Math.abs((suggested ?? 0) - (current ?? 0)) > 0.001;
          return (
            <div
              key={i}
              className={`border rounded-md bg-white px-4 py-2 flex flex-col ${
                changed
                  ? "ring-1 ring-yellow-300 bg-yellow-50"
                  : "ring-1 ring-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 min-h-[32px]">
                <span className="text-[16px] font-bold text-gray-800 tracking-wide">
                  {hour}
                </span>
                {changed && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[9px] font-semibold uppercase">
                    Zmiana
                  </span>
                )}
                <span className="ml-auto flex items-center">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </span>
                </span>
              </div>
              <div className="text-[15px] text-gray-700 flex items-center gap-2">
                <span>
                  {current}{" "}
                  <span className="text-gray-400 text-[13px]">mg/dL/U</span>
                </span>
                <span className="text-gray-400 text-[18px]">→</span>
                <span className="font-bold text-blue-900">
                  {suggested}
                </span>{" "}
                <span className="text-gray-400 text-[13px]">mg/dL/U</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto hidden md:block rounded-xl shadow-lg overflow-hidden">
        <table className="w-full min-w-[420px] border text-[15px]">
          <thead>
            <tr className="bg-gray-100">
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
            {displayData.map((s, i) => {
              const hour =
                s.time ||
                (s.hour !== undefined
                  ? String(s.hour).padStart(2, "0") + ":00"
                  : "");
              const current = s.currentISF !== undefined ? s.currentISF : s.old;
              const suggested =
                s.suggestedISF !== undefined ? s.suggestedISF : s.new;
              const pct =
                current && suggested
                  ? Math.round(((suggested - current) / current) * 100)
                  : s.adjustmentPct !== undefined
                  ? s.adjustmentPct
                  : s.pct;
              const changed =
                Math.abs((suggested ?? 0) - (current ?? 0)) > 0.001;
              return (
                <tr
                  key={i}
                  className={`transition-colors duration-150 border-b hover:bg-gray-100 ${
                    changed ? "bg-yellow-50 hover:bg-yellow-100" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2 border-b text-center text-[15px] font-bold text-gray-800">
                    {hour}
                  </td>
                  <td className="px-3 py-2 border-b text-center text-gray-700">
                    {current}
                  </td>
                  <td className="px-3 py-2 border-b text-center text-blue-900 font-semibold">
                    {suggested}
                  </td>
                  <td className="px-3 py-2 border-b text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold">
                      {pct > 0 ? "+" : ""}
                      {pct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New slots section */}
      {newSlotsData && newSlotsData.length > 0 && (
        <div className="mt-8">
          <h4 className="font-semibold mb-2 text-yellow-700 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400"></span>
            Nowe sugerowane sloty ISF
          </h4>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {newSlotsData.map((s, i) => {
              const hour =
                s.time ||
                (s.hour !== undefined
                  ? String(s.hour).padStart(2, "0") + ":00"
                  : "");
              const current = s.currentISF !== undefined ? s.currentISF : s.old;
              const suggested =
                s.suggestedISF !== undefined ? s.suggestedISF : s.new;
              const pct =
                current && suggested
                  ? Math.round(((suggested - current) / current) * 100)
                  : s.adjustmentPct !== undefined
                  ? s.adjustmentPct
                  : s.pct;
              return (
                <div
                  key={i}
                  className="border rounded-md bg-yellow-50 ring-1 ring-yellow-300 px-4 py-2 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-1 min-h-[32px]">
                    <span className="text-[16px] font-bold text-yellow-900 tracking-wide">
                      {hour}
                    </span>
                    <span className="ml-auto flex items-center">
                      <span className="px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[13px] font-semibold flex items-center">
                        Nowy slot
                      </span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                        {pct > 0 ? "+" : ""}
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <div className="text-[15px] text-gray-700 flex items-center gap-2">
                    <span>
                      {current !== undefined ? current : "-"}{" "}
                      <span className="text-gray-400 text-[13px]">mg/dL/U</span>
                    </span>
                    <span className="text-gray-400 text-[18px]">→</span>
                    <span className="font-bold text-blue-900">
                      {suggested}
                    </span>{" "}
                    <span className="text-gray-400 text-[13px]">mg/dL/U</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop: table */}
          <div className="overflow-x-auto hidden md:block rounded-xl shadow-lg overflow-hidden mt-2">
            <table className="w-full min-w-[420px] border text-[15px]">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="px-3 py-2 border-b text-center font-semibold text-yellow-900">
                    Godzina
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold text-yellow-900">
                    Aktualne (mg/dL/U)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold text-yellow-900">
                    Sugerowane (mg/dL/U)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold text-yellow-900">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {newSlotsData.map((s, i) => {
                  const hour =
                    s.time ||
                    (s.hour !== undefined
                      ? String(s.hour).padStart(2, "0") + ":00"
                      : "");
                  const current =
                    s.currentISF !== undefined ? s.currentISF : s.old;
                  const suggested =
                    s.suggestedISF !== undefined ? s.suggestedISF : s.new;
                  const pct =
                    current && suggested
                      ? Math.round(((suggested - current) / current) * 100)
                      : s.adjustmentPct !== undefined
                      ? s.adjustmentPct
                      : s.pct;
                  return (
                    <tr
                      key={i}
                      className="transition-colors duration-150 border-b bg-yellow-50 hover:bg-yellow-100"
                    >
                      <td className="px-3 py-2 border-b text-center text-[15px] font-bold text-yellow-900">
                        {hour}
                      </td>
                      <td className="px-3 py-2 border-b text-center text-gray-700">
                        {current !== undefined ? current : "-"}
                      </td>
                      <td className="px-3 py-2 border-b text-center text-blue-900 font-semibold">
                        {suggested}
                      </td>
                      <td className="px-3 py-2 border-b text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[13px] font-semibold">
                          {pct > 0 ? "+" : ""}
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
