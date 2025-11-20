import React, { useState } from "react";

/**
 * Component for displaying profile change warnings and timeline
 */
export default function ProfileChangeWarning({ profileChangeAnalysis }) {
  if (!profileChangeAnalysis) return null;

  const { hasChanges, changes, recommendation } = profileChangeAnalysis;

  if (!hasChanges) {
    return null;
  }

  // Determine warning level based on recommendation
  const bgColor = "bg-yellow-50";
  const borderColor = "border-yellow-200";
  const textColor = "text-gray-600";
  const iconColor = "text-yellow-600";
  const icon = "⚠️";

  // Stan rozwinięcia szczegółów dla każdego dnia
  const [expandedDays, setExpandedDays] = useState({});

  // Funkcja do przełączania widoczności szczegółów dla danego dnia
  const toggleDay = (dateStr) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  return (
    <div
      className={`p-4 ${bgColor} border ${borderColor} rounded-xl shadow-lg mb-4`}
    >
      {/* Main warning/info */}
      <div className="flex items-start mb-3">
        <div className={`${iconColor} mr-2 text-lg`}>{icon}</div>
        <div className={`flex-1`}>
          <div className="font-semibold mb-1">
            {"Uwaga: Wykryto niedawne zmiany profilu"}
          </div>
        </div>
      </div>

      {/* Timeline of changes + details (grouped by date) */}
      {changes.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="space-y-2">
            {(() => {
              // Group changes by date
              const grouped = {};
              changes.forEach((change) => {
                const key = change.date.toISOString().slice(0, 10);
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(change);
              });
              return Object.entries(grouped).map(
                ([dateStr, dayChanges], idx) => {
                  const isExpanded = !!expandedDays[dateStr];
                  // Zbierz typy zmian dla danego dnia
                  const changedTypes = Array.from(
                    new Set(dayChanges.map((dc) => dc.changeType))
                  );
                  // Mapuj na czytelne etykiety
                  const fieldLabels = {
                    basal: "baza",
                    icr: "ICR",
                    isf: "ISF",
                  };
                  const changedTypesLabel = changedTypes
                    .map((t) => fieldLabels[t] || t.toUpperCase())
                    .join(", ");
                  return (
                    <div key={dateStr + idx} className="mb-2">
                      <div className="flex items-center text-[15px] text-gray-700">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        <div className="flex-1">
                          <span className="font-semibold">
                            {formatDate(new Date(dateStr))}
                            {changedTypesLabel && (
                              <span className="text-gray-500 font-normal text-[14px] ml-1">
                                ({changedTypesLabel})
                              </span>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={
                            "ml-2 px-3 py-1 rounded font-semibold text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                          }
                          onClick={() => toggleDay(dateStr)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Ukryj szczegóły" : "Pokaż szczegóły"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-4">
                          <div className="text-xs text-gray-700">
                            {dayChanges.map((change, i) => {
                              const field = change.changeType;
                              const prevArr =
                                (change.prev && change.prev[field]) || [];
                              const currArr =
                                (change.curr && change.curr[field]) || [];
                              // Build a map: hour -> value
                              const prevMap = new Map(
                                (prevArr || []).map((s) => [
                                  s.time,
                                  parseFloat(s.value),
                                ])
                              );
                              const currMap = new Map(
                                (currArr || []).map((s) => [
                                  s.time,
                                  parseFloat(s.value),
                                ])
                              );
                              const allTimes = Array.from(
                                new Set([...prevMap.keys(), ...currMap.keys()])
                              ).sort();
                              // Filter only those hours where something changed
                              const changedTimes = allTimes.filter((time) => {
                                const oldVal = prevMap.has(time)
                                  ? prevMap.get(time)
                                  : null;
                                const newVal = currMap.has(time)
                                  ? currMap.get(time)
                                  : null;
                                return oldVal !== newVal;
                              });
                              if (changedTimes.length === 0) return null;
                              // Map slot type to readable label
                              const fieldLabels = {
                                basal: "Zmiany w profilu bazy",
                                icr: "Zmiany w profilu ICR",
                                isf: "Zmiany w profilu ISF",
                              };
                              return (
                                <div key={field} className="mb-4">
                                  <span className="font-semibold text-[14px] mb-2 block">
                                    {fieldLabels[field] || field.toUpperCase()}:
                                  </span>
                                  {/* Mobile: paski, Desktop: card-table */}
                                  <div>
                                    {/* Mobile: paski */}
                                    <div className="flex flex-col gap-1 md:hidden">
                                      {changedTimes.map((time) => {
                                        const oldVal = prevMap.has(time)
                                          ? prevMap.get(time)
                                          : null;
                                        const newVal = currMap.has(time)
                                          ? currMap.get(time)
                                          : null;
                                        let delta = null;
                                        if (
                                          oldVal !== null &&
                                          newVal !== null &&
                                          oldVal !== 0
                                        ) {
                                          delta =
                                            ((newVal - oldVal) / oldVal) * 100;
                                        } else if (
                                          oldVal === null &&
                                          newVal !== null
                                        ) {
                                          delta = 100;
                                        } else if (
                                          oldVal !== null &&
                                          newVal === null
                                        ) {
                                          delta = -100;
                                        }
                                        const isChanged = oldVal !== newVal;
                                        // Units for each field
                                        const units =
                                          field === "basal"
                                            ? "U/h"
                                            : field === "icr"
                                            ? "g/U"
                                            : field === "isf"
                                            ? "mg/dL/U"
                                            : "";
                                        return (
                                          <div
                                            key={time}
                                            className="relative border border-gray-200 rounded-md px-6 py-2 bg-white flex items-center min-h-[32px]"
                                            style={{ fontSize: "13px" }}
                                          >
                                            <span className="font-bold text-gray-800 min-w-[44px] text-[13.5px]">
                                              {time}
                                            </span>
                                            <span className="text-gray-500 ml-4">
                                              {oldVal !== null ? (
                                                oldVal
                                              ) : (
                                                <span className="text-gray-300">
                                                  —
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-gray-400 mx-1">
                                              →
                                            </span>
                                            <span className="text-blue-900 font-bold">
                                              {newVal !== null ? (
                                                newVal
                                              ) : (
                                                <span className="text-gray-300">
                                                  —
                                                </span>
                                              )}
                                            </span>
                                            {units && (
                                              <span className="text-gray-400 ml-1 font-normal">
                                                {units}
                                              </span>
                                            )}
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px] font-semibold">
                                              {oldVal === null &&
                                              newVal !== null ? (
                                                <span>Nowy slot</span>
                                              ) : delta !== null ? (
                                                `${
                                                  delta > 0 ? "+" : ""
                                                }${Math.round(delta)}%`
                                              ) : (
                                                <span>—</span>
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* Desktop: card-table */}
                                    <div className="hidden md:block">
                                      <table className="min-w-[320px] w-full rounded-xl overflow-hidden shadow border text-xs mt-1 mb-1">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="px-3 py-2 border-b text-center font-semibold">
                                              Godzina
                                            </th>
                                            <th className="px-3 py-2 border-b text-center font-semibold">
                                              Przed zmianą
                                            </th>
                                            <th className="px-3 py-2 border-b text-center font-semibold">
                                              Po zmianie
                                            </th>
                                            <th className="px-3 py-2 border-b text-center font-semibold">
                                              Δ
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {changedTimes.map(
                                            (time, idx, arr) => {
                                              const oldVal = prevMap.has(time)
                                                ? prevMap.get(time)
                                                : null;
                                              const newVal = currMap.has(time)
                                                ? currMap.get(time)
                                                : null;
                                              let delta = null;
                                              if (
                                                oldVal !== null &&
                                                newVal !== null &&
                                                oldVal !== 0
                                              ) {
                                                delta =
                                                  ((newVal - oldVal) / oldVal) *
                                                  100;
                                              } else if (
                                                oldVal === null &&
                                                newVal !== null
                                              ) {
                                                delta = 100;
                                              } else if (
                                                oldVal !== null &&
                                                newVal === null
                                              ) {
                                                delta = -100;
                                              }
                                              // Szary border tylko pomiędzy wierszami
                                              const borderClass =
                                                idx < arr.length - 1
                                                  ? "border-b border-gray-200"
                                                  : "";
                                              return (
                                                <tr
                                                  key={time}
                                                  className={`bg-white ${borderClass} transition-colors duration-150`}
                                                >
                                                  <td className="px-3 py-2 text-center text-[13px] font-bold text-gray-800">
                                                    {time}
                                                  </td>
                                                  <td className="px-3 py-2 text-center text-gray-700">
                                                    {oldVal !== null ? (
                                                      oldVal
                                                    ) : (
                                                      <span className="text-gray-300">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-center text-blue-900 font-semibold">
                                                    {newVal !== null ? (
                                                      newVal
                                                    ) : (
                                                      <span className="text-gray-300">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[13px]">
                                                      {oldVal === null &&
                                                      newVal !== null ? (
                                                        <span>Nowy slot</span>
                                                      ) : delta !== null ? (
                                                        `${
                                                          delta > 0 ? "+" : ""
                                                        }${delta.toFixed(1)}%`
                                                      ) : (
                                                        <span>—</span>
                                                      )}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            }
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              );
            })()}
          </div>
        </div>
      )}

      {/* Additional guidance */}
      <div
        className={`border-t border-gray-200 pt-3 mt-3 text-xs ${textColor.replace(
          "800",
          "700"
        )}`}
      >
        <strong>Zalecenie:</strong> Rozważ analizę krótszego okresu lub akceptuj
        wyniki z ostrożnością. Najlepsze rezultaty uzyskasz analizując dane po
        stabilizacji profilu.
      </div>
    </div>
  );
}

/**
 * Format date for display
 */
function formatDate(date) {
  // Handle invalid dates
  if (!date || isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "wczoraj";
  } else if (diffDays < 7) {
    return `${diffDays} dni temu`;
  } else {
    return date.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
