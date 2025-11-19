import React, { useState } from "react";

/**
 * Component for displaying ICR analysis with existing profile slots
 */
export default function ICRComparisonTable({ icrData, icrStructuredData }) {
  // Helper: ile miejsc po przecinku ma skok bazy
  function getStepDecimals(step) {
    if (!step || isNaN(step)) return 2;
    // Spróbuj pobrać oryginalny string skoku z icrStructuredData, jeśli jest
    let s = undefined;
    if (
      icrStructuredData &&
      typeof icrStructuredData.suggestedICRStep === "string"
    ) {
      s = icrStructuredData.suggestedICRStep;
    } else if (typeof step === "string") {
      s = step;
    } else {
      s = Number(step).toFixed(20);
    }
    if (s.indexOf(".") === -1) return 0;
    return s.split(".")[1].length;
  }

  // Helper: zaokrąglij do najbliższego wielokrotności skoku i sformatuj z daną liczbą miejsc po przecinku, ucinaj końcowe zera
  function formatWithStep(val, step) {
    if (val == null || isNaN(val) || !step || isNaN(step)) return "";
    const decimals = getStepDecimals(step);
    // Zaokrąglij do najbliższego wielokrotności skoku
    const rounded = Math.round(val / step) * step;
    let str = rounded.toFixed(decimals);
    // Usuń końcowe zera po przecinku i ewentualnie kropkę/przecinek
    str = str.replace(/([.,]0+|(?<=[.,])0+)$/, "");
    str = str.replace(/[.,]$/, "");
    return str.replace(".", ",");
  }
  const [showUnchanged, setShowUnchanged] = useState(false);
  // Use structured data if available
  const hasStructuredData =
    icrStructuredData &&
    (icrStructuredData.modifications?.length > 0 ||
      icrStructuredData.profileCompliant?.length > 0);

  if (!hasStructuredData && (!icrData || icrData.length === 0)) {
    return (
      <section className="p-4 border rounded-xl bg-white shadow overflow-hidden">
        <h3 className="font-semibold mb-2">Profil ICR</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  // Render structured data with profile slots only
  if (hasStructuredData) {
    const slots = [
      ...(icrStructuredData.profileCompliant || []),
      ...(icrStructuredData.modifications || []),
    ].sort((a, b) => a.hour - b.hour);
    // Ustal skok bazy (suggestedICRStep) jeśli jest dostępny
    const step = icrStructuredData?.suggestedICRStep || 2;
    return (
      <section className="p-4 border bg-white rounded-xl shadow-lg">
        <h3 className="font-semibold mb-2">Profil ICR</h3>
        {/* Toggle for unchanged slots */}
        <div className="mb-2 md:hidden">
          <button
            className="text-xs px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700"
            onClick={() => setShowUnchanged((v) => !v)}
          >
            {showUnchanged ? "Ukryj sloty bez zmiany" : "Pokaż wszystkie sloty"}
          </button>
        </div>
        {/* Mobile: timeline-style cards */}
        <div className="flex flex-col gap-1 md:hidden">
          {slots
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
                  } border-b`}
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
                      {s.currentICR}{" "}
                      <span className="text-gray-400 text-[13px]">g/U</span>
                    </span>
                    <span className="text-gray-400 text-[18px]">→</span>
                    <span className="font-bold text-blue-900">
                      {formatWithStep(s.suggestedICR, step)}
                    </span>{" "}
                    <span className="text-gray-400 text-[13px]">g/U</span>
                  </div>
                  <div className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-2">
                    {/* U/1WW: jeśli nie ma zmiany, tylko wartość na czarno; jeśli jest zmiana, stara szara, strzałka, nowa niebieska */}
                    {s.currentICR === s.suggestedICR ? (
                      <span className="text-gray-900">
                        {formatUperWW(10 / s.currentICR)}
                        <span className="text-gray-400 text-[11px]">
                          {" "}
                          U/1WW
                        </span>
                      </span>
                    ) : (
                      <>
                        <span className="text-gray-700">
                          {formatUperWW(10 / s.currentICR)}
                          <span className="text-gray-400 text-[11px]">
                            {" "}
                            U/1WW
                          </span>
                        </span>
                        <span className="mx-1 text-gray-400 text-[15px]">
                          →
                        </span>
                        <span className="font-bold text-blue-900">
                          {formatUperWW(10 / s.suggestedICR)}
                          <span className="text-gray-400 text-[11px]">
                            {" "}
                            U/1WW
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        {/* Desktop: table */}
        <div className="overflow-x-auto hidden md:block rounded-xl shadow-lg overflow-hidden">
          <table className="w-full min-w-[500px] border text-[15px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-center">Godzina</th>
                <th className="p-2 text-center">Aktualne (g/U)</th>
                <th className="p-2 text-center">Sugerowane (g/U)</th>
                <th className="px-3 py-2 border-b text-center font-semibold">
                  U/1WW
                </th>
                <th className="p-2 text-center">Δ</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => (
                <tr
                  key={i}
                  className={`transition-colors duration-150 border-b ${
                    s.isProfileCompliant
                      ? "bg-white hover:bg-gray-100"
                      : "bg-yellow-50 hover:bg-yellow-100"
                  }`}
                >
                  <td className="p-2 text-center">
                    {String(s.hour).padStart(2, "0")}:00
                  </td>
                  <td className="p-2 text-center">{s.currentICR}</td>
                  <td className="p-2 text-center font-bold text-blue-900">
                    {formatWithStep(s.suggestedICR, step)}
                  </td>
                  <td className="p-2 text-center">
                    {s.currentICR === s.suggestedICR ? (
                      <span className="text-gray-900">
                        {formatUperWW(10 / s.currentICR)}
                      </span>
                    ) : (
                      <>
                        <span className="text-gray-700">
                          {formatUperWW(10 / s.currentICR)}
                        </span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="font-bold text-blue-900">
                          {formatUperWW(10 / s.suggestedICR)}
                        </span>
                      </>
                    )}
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
        </div>
      </section>
    );
  }

  // Fallback to single table for backward compatibility
  const slots = icrData || [];
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Profil ICR</h3>
      {/* Mobile: timeline-style cards */}
      <div className="flex flex-col gap-1 md:hidden">
        {slots.map((c, i) => {
          const isChanged = !!c.pct;
          const delta = `${c.pct > 0 ? "+" : ""}${c.pct}%`;
          return (
            <div
              key={i}
              className={`relative border rounded-md px-4 py-2 bg-white ${
                isChanged
                  ? "ring-1 ring-yellow-300 bg-yellow-50"
                  : "ring-1 ring-gray-200"
              } border-b`}
            >
              {/* Linia 1: godzina + tag z nową wartością */}
              <div className="flex items-center gap-2 mb-0.5 min-h-[32px]">
                <span className="text-[16px] font-bold text-gray-800 tracking-wide">
                  {c.time}
                </span>
                {isChanged && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[9px] font-semibold uppercase">
                    Zmiana
                  </span>
                )}
                <span className="ml-auto flex items-center h-full absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                    {c.pct > 0 ? "+" : ""}
                    {c.pct}%
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
                  {c.old} <span className="text-gray-400 text-[13px]">g/U</span>
                </span>
                <span className="text-gray-400 text-[18px]">→</span>
                <span className="font-bold text-blue-900">{c.new}</span>{" "}
                <span className="text-gray-400 text-[13px]">g/U</span>
              </div>
              <div className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-2">
                <span>
                  {formatUperWW(10 / c.old)}
                  <span className="text-gray-400 text-[11px]"> U/1WW</span>
                </span>
                <span className="text-gray-400 text-[15px]">→</span>
                <span className="font-bold text-blue-900">
                  {formatUperWW(10 / c.new)}
                  <span className="text-gray-400 text-[11px]"> U/1WW</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop: table */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full table-auto text-sm min-w-[500px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-center">Godzina</th>
              <th className="p-2 text-center">Aktualne (g/U)</th>
              <th className="p-2 text-center">Sugerowane (g/U)</th>
              <th className="px-3 py-2 border-b text-center font-semibold">
                U/WW
              </th>
              <th className="p-2 text-center">Δ</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((c, i) => (
              <tr
                key={i}
                className={`transition-colors duration-150 border-b hover:bg-gray-100 ${
                  c.pct ? "bg-yellow-50 hover:bg-yellow-100" : ""
                }`}
              >
                <td className="p-2 text-center">{c.time}</td>
                <td className="p-2 text-center">{c.old}</td>
                <td className="p-2 text-center font-bold text-blue-900">
                  {c.new}
                </td>
                <td className="p-2 text-center">
                  {c.oldUperWW === c.newUperWW ? (
                    <span className="text-gray-900">{c.oldUperWW}</span>
                  ) : (
                    <>
                      <span className="text-gray-700">{c.oldUperWW}</span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="font-bold text-blue-900">
                        {c.newUperWW}
                      </span>
                    </>
                  )}
                </td>
                <td className="p-2 text-center">
                  {c.pct > 0 ? "+" : ""}
                  {c.pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Helper to format U/1WW values without trailing zeros
function formatUperWW(val) {
  if (val == null || isNaN(val)) return "";
  // Remove trailing zeros and use comma as decimal separator
  let str = parseFloat(val.toFixed(2)).toString();
  return str.replace(".", ",");
}
