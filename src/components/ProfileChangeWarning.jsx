import React from "react";

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
  const isWarning = !recommendation.shouldUseSegmentation;
  const bgColor = isWarning ? "bg-yellow-50" : "bg-blue-50";
  const borderColor = isWarning ? "border-yellow-200" : "border-blue-200";
  const textColor = isWarning ? "text-yellow-800" : "text-blue-800";
  const iconColor = isWarning ? "text-yellow-600" : "text-blue-600";
  const icon = isWarning ? "⚠️" : "ℹ️";

  return (
    <div className={`p-4 ${bgColor} border ${borderColor} rounded mb-4`}>
      {/* Main warning/info */}
      <div className="flex items-start mb-3">
        <div className={`${iconColor} mr-2 text-lg`}>{icon}</div>
        <div className={`${textColor} flex-1`}>
          <div className="font-semibold mb-1">
            {isWarning
              ? "Uwaga: Wykryto zmiany profilu"
              : "Info: Zastosowano segmentację danych"}
          </div>
          <div className="text-sm">{recommendation.reason}</div>
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
                ([dateStr, dayChanges], idx) => (
                  <div key={dateStr + idx} className="mb-2">
                    <div className="flex items-center text-xs text-gray-600">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <div className="flex-1">
                        <span className="font-medium">
                          {formatDate(new Date(dateStr))}
                        </span>
                      </div>
                    </div>
                    <div className="ml-6 mt-1">
                      <span className="font-semibold text-gray-700 text-base mb-2 block">
                        Szczegóły zmiany profilu:
                      </span>
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
                            <div key={field} className="mb-2">
                              <span className="font-semibold">
                                {fieldLabels[field] || field.toUpperCase()}:
                              </span>
                              <table className="min-w-[220px] border text-xs mt-1 mb-1">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-2 py-1 border text-center">
                                      Godzina
                                    </th>
                                    <th className="px-2 py-1 border text-center">
                                      Przed zmianą
                                    </th>
                                    <th className="px-2 py-1 border text-center">
                                      Po zmianie
                                    </th>
                                    <th className="px-2 py-1 border text-center">
                                      Δ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
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
                                    return (
                                      <tr
                                        key={time}
                                        className={
                                          "bg-yellow-50 hover:bg-yellow-100 transition-colors duration-150"
                                        }
                                      >
                                        <td className="px-2 py-1 border font-mono text-center">
                                          {time}
                                        </td>
                                        <td className="px-2 py-1 border text-center">
                                          {oldVal !== null ? (
                                            oldVal
                                          ) : (
                                            <span className="text-gray-400">
                                              —
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 border text-center">
                                          {newVal !== null ? (
                                            newVal
                                          ) : (
                                            <span className="text-gray-400">
                                              —
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 border text-center">
                                          {oldVal === null &&
                                          newVal !== null ? (
                                            <span className="text-green-700 font-semibold">
                                              Nowy slot
                                            </span>
                                          ) : delta !== null ? (
                                            `${
                                              delta > 0 ? "+" : ""
                                            }${delta.toFixed(1)}%`
                                          ) : (
                                            <span className="text-gray-400">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
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
        {isWarning ? (
          <>
            <strong>Zalecenie:</strong> Rozważ analizę krótszego okresu lub
            akceptuj wyniki z ostrożnością. Najlepsze rezultaty uzyskasz
            analizując dane po stabilizacji profilu.
          </>
        ) : (
          <>
            <strong>Analiza optymalna:</strong> Używane są tylko dane po
            ostatniej zmianie profilu, co zapewnia bardziej precyzyjne
            rekomendacje.
          </>
        )}
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
