import React, { useState, useEffect } from "react";
import Big from "big.js";
import BasalProfileChart from "./BasalProfileChart";

export default function BasalComparisonTable({ basalData, basalStep = 0.05 }) {
  // Helper: how many decimal places the step has
  function getStepDecimals(step) {
    if (!step || isNaN(step)) return 2;
    let s = typeof step === "string" ? step : Number(step).toFixed(20);
    if (s.indexOf(".") === -1) return 0;
    return s.split(".")[1].replace(/0+$/, "").length;
  }

  // Helper: round to the nearest multiple of step and format with the given number of decimals, trim trailing zeros
  function formatWithStep(val, step) {
    if (val == null || isNaN(val) || !step || isNaN(step)) return "";
    const decimals = getStepDecimals(step);
    try {
      const bigVal = Big(val);
      const bigStep = Big(step);
      // Divide, round to nearest integer, then multiply back
      const rounded = bigStep.times(bigVal.div(bigStep).round(0, 3)); // 3 = round half up
      let str = rounded.toFixed(decimals);
      // Replace dot with comma
      str = str.replace(".", ",");
      // Remove trailing zeros after the decimal separator
      str = str.replace(/(,\d*?[1-9])0+$/g, "$1");
      // If only zeros or nothing remain after the comma, remove the comma
      str = str.replace(/,0*$/, "");
      return str;
    } catch (e) {
      return "";
    }
  }
  const [showUnchanged, setShowUnchanged] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(min-width: 768px)").matches;
    }
    return false;
  });

  // Synchronizuj stan przy zmianie rozmiaru okna (np. po przełączeniu mobile/desktop)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => {
      setShowUnchanged(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return (
    <section className="p-4 border bg-white rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center">Profil bazy</h3>
        <button
          className={
            "ml-2 px-3 py-1 rounded font-semibold text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }
          onClick={() => setShowUnchanged((v) => !v)}
        >
          {showUnchanged ? "Ukryj sloty bez zmiany" : "Pokaż wszystkie sloty"}
        </button>
      </div>

      {!basalData || basalData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Brak danych</p>
        </div>
      ) : (
        <>
          {/* Mobile: karty */}
          <div className="flex flex-col gap-1 md:hidden">
            {basalData
              .filter((b) => showUnchanged || Math.abs(b.new - b.old) > 0.001)
              .map((b, idx) => {
                const changed = Math.abs(b.new - b.old) > 0.001;
                const delta = `${b.pct > 0 ? "+" : ""}${b.pct}%`;
                return (
                  <div
                    key={idx}
                    className={`relative border rounded-md px-6 py-2 bg-white ${
                      changed
                        ? "ring-1 ring-yellow-300 bg-yellow-50"
                        : "ring-1 ring-gray-200"
                    }`}
                  >
                    {/* Linia 1: godzina + tag z nową wartością */}
                    <div className="flex items-center gap-2 mb-0.5 min-h-[32px]">
                      <span className="text-[16px] font-bold text-gray-800 tracking-wide">
                        {b.time}
                      </span>
                      {changed && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[9px] font-semibold uppercase">
                          Zmiana
                        </span>
                      )}
                      <span className="ml-auto flex items-center h-full absolute right-4 top-1/2 -translate-y-1/2">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center">
                          {b.pct > 0 ? "+" : ""}
                          {b.pct}%
                        </span>
                      </span>
                    </div>
                    <style>{`
                      @media (max-width: 767px) {
                        .relative-card {
                          position: relative;
                        }
                      }
                    `}</style>
                    {/* Linia 2: stara wartość → nowa wartość (+delta) */}
                    <div className="text-[15px] text-gray-700 mt-0.5 flex items-center gap-2">
                      <span>
                        {formatWithStep(b.old, basalStep)}{" "}
                        <span className="text-gray-400 text-[13px]">U/h</span>
                      </span>
                      <span className="text-gray-400 text-[18px]">→</span>
                      <span className="font-bold text-blue-900">
                        {formatWithStep(b.new, basalStep)}
                      </span>{" "}
                      <span className="text-gray-400 text-[13px]">U/h</span>
                    </div>
                  </div>
                );
              })}
          </div>
          {/* Desktop: tabela */}
          <div className="overflow-x-auto hidden md:block rounded-xl shadow-lg overflow-hidden">
            <table className="w-full min-w-[420px] border text-[15px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Godzina
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Aktualne (U/h)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Sugerowane (U/h)
                  </th>
                  <th className="px-3 py-2 border-b text-center font-semibold">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {basalData
                  .filter(
                    (b) => showUnchanged || Math.abs(b.new - b.old) > 0.001
                  )
                  .map((b, idx) => {
                    const changed = Math.abs(b.new - b.old) > 0.001;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors duration-150 border-b hover:bg-gray-100 ${
                          changed
                            ? "bg-yellow-50 hover:bg-yellow-100"
                            : "bg-white"
                        }`}
                      >
                        <td className="px-3 py-2 border-b text-center text-[15px] font-bold text-gray-800">
                          {b.time}
                        </td>
                        <td className="px-3 py-2 border-b text-center text-gray-700">
                          {formatWithStep(b.old, basalStep)}
                        </td>
                        <td className="px-3 py-2 border-b text-center text-blue-900 font-semibold">
                          {formatWithStep(b.new, basalStep)}
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold">
                            {b.pct > 0 ? "+" : ""}
                            {b.pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <BasalProfileChart basalData={basalData} />
    </section>
  );
}
