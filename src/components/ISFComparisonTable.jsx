import React from "react";

/**
 * Component for displaying ISF analysis with separate tables for modifications and new slots
 */
export default function ISFComparisonTable({ isfData, isfStructuredData }) {
  // Use structured data if available for separate display
  const hasStructuredData =
    isfStructuredData &&
    (isfStructuredData.modifications?.length > 0 ||
      isfStructuredData.newSlots?.length > 0);

  if (!hasStructuredData && (!isfData || isfData.length === 0)) {
    return (
      <section className="p-4 border rounded bg-white">
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
          <section className="p-4 border rounded bg-white">
            <h3 className="font-semibold mb-2">
              Profil ISF - Istniejące sloty
            </h3>
            <table className="w-full table-auto text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-center">Godzina</th>
                  <th className="p-2 text-center">Aktualne (mg/dL/U)</th>
                  <th className="p-2 text-center">Sugerowane (mg/dL/U)</th>
                  <th className="p-2 text-center">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {/* Show profile compliant slots first (sorted by hour) */}
                {isfStructuredData.profileCompliant
                  ?.sort((a, b) => a.hour - b.hour)
                  .map((s, i) => (
                    <tr
                      key={`compliant-${i}`}
                      className="hover:bg-gray-100 transition-colors duration-150"
                    >
                      <td className="p-2 text-center">
                        {String(s.hour).padStart(2, "0")}:00
                      </td>
                      <td className="p-2 text-center">{s.currentISF}</td>
                      <td className="p-2 text-center font-medium">
                        {s.suggestedISF}
                      </td>
                      <td className="p-2 text-center">
                        {s.adjustmentPct > 0 ? "+" : ""}
                        {s.adjustmentPct}%
                      </td>
                    </tr>
                  ))}

                {/* Show modifications (sorted by hour) */}
                {isfStructuredData.modifications
                  ?.sort((a, b) => a.hour - b.hour)
                  .map((s, i) => (
                    <tr
                      key={`mod-${i}`}
                      className="hover:bg-yellow-100 transition-colors duration-150 bg-yellow-50"
                    >
                      <td className="p-2 text-center">
                        {String(s.hour).padStart(2, "0")}:00
                      </td>
                      <td className="p-2 text-center">{s.currentISF}</td>
                      <td className="p-2 text-center font-medium">
                        {s.suggestedISF}
                      </td>
                      <td className="p-2 text-center">
                        {s.adjustmentPct > 0 ? "+" : ""}
                        {s.adjustmentPct}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Table 2: New slots to add */}
        {isfStructuredData.newSlots?.length > 0 && (
          <section className="p-4 border rounded bg-white">
            <h3 className="font-semibold mb-2">
              ✨ Profil ISF - Nowe sloty do dodania
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Sugerowane time sloty które należy dodać do profilu
            </p>
            <table className="w-full table-auto text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-center">Godzina</th>
                  <th className="p-2 text-center">Aktualne (mg/dL/U)</th>
                  <th className="p-2 text-center">Sugerowane (mg/dL/U)</th>
                  <th className="p-2 text-center">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {isfStructuredData.newSlots.map((s, i) => (
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
                      {s.adjustmentPct > 0 ? "+" : ""}
                      {s.adjustmentPct}%
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
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Profil ISF</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-center">Godzina</th>
            <th className="p-2 text-center">Aktualne (mg/dL/U)</th>
            <th className="p-2 text-center">Sugerowane (mg/dL/U)</th>
            <th className="p-2 text-center">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {isfData?.map((s, i) => (
            <tr
              key={i}
              className="hover:bg-gray-100 transition-colors duration-150"
            >
              <td className="p-2 text-center">{s.time}</td>
              <td className="p-2 text-center">{s.old}</td>
              <td className="p-2 text-center font-medium">{s.new}</td>
              <td className="p-2 text-center">{s.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
