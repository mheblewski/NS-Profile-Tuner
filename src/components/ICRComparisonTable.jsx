import React from "react";

/**
 * Component for displaying ICR analysis with existing profile slots
 */
export default function ICRComparisonTable({ icrData, icrStructuredData }) {
  // Use structured data if available
  const hasStructuredData =
    icrStructuredData &&
    (icrStructuredData.modifications?.length > 0 ||
      icrStructuredData.profileCompliant?.length > 0);

  if (!hasStructuredData && (!icrData || icrData.length === 0)) {
    return (
      <section className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-2">Profil ICR</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  // Render structured data with profile slots only
  if (hasStructuredData) {
    return (
      <section className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-2">Profil ICR</h3>
        <table className="w-full table-auto text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-center">Godzina</th>
              <th className="p-2 text-center">Aktualne (g/U)</th>
              <th className="p-2 text-center">Sugerowane (g/U)</th>
              <th className="p-2 text-center">Δ</th>
              <th className="p-2 text-center">U/WW</th>
            </tr>
          </thead>
          <tbody>
            {/* Combine and sort all slots by hour */}
            {[
              ...(icrStructuredData.profileCompliant || []),
              ...(icrStructuredData.modifications || []),
            ]
              .sort((a, b) => a.hour - b.hour)
              .map((s, i) => (
                <tr
                  key={i}
                  className={`hover:bg-gray-100 transition-colors duration-150 ${
                    s.isProfileCompliant
                      ? ""
                      : "bg-yellow-50 hover:bg-yellow-100"
                  }`}
                >
                  <td className="p-2 text-center">
                    {String(s.hour).padStart(2, "0")}:00
                  </td>
                  <td className="p-2 text-center">{s.currentICR}</td>
                  <td className="p-2 text-center font-medium">
                    {s.suggestedICR}
                  </td>
                  <td className="p-2 text-center">
                    {s.adjustmentPct > 0 ? "+" : ""}
                    {s.adjustmentPct}%
                  </td>
                  <td className="p-2 text-center">
                    {(10 / s.currentICR).toFixed(2)} →{" "}
                    <strong>{(10 / s.suggestedICR).toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    );
  }

  // Fallback to single table for backward compatibility
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Profil ICR</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-center">Godzina</th>
            <th className="p-2 text-center">Aktualne (g/U)</th>
            <th className="p-2 text-center">Sugerowane (g/U)</th>
            <th className="p-2 text-center">Δ</th>
            <th className="p-2 text-center">U/WW</th>
          </tr>
        </thead>
        <tbody>
          {icrData?.map((c, i) => (
            <tr
              key={i}
              className={`hover:bg-gray-100 transition-colors duration-150 ${
                c.pct ? "bg-yellow-50 hover:bg-yellow-100" : ""
              }`}
            >
              <td className="p-2 text-center">{c.time}</td>
              <td className="p-2 text-center">{c.old}</td>
              <td className="p-2 text-center font-medium">{c.new}</td>
              <td className="p-2 text-center">
                {c.pct > 0 ? "+" : ""}
                {c.pct}%
              </td>
              <td className="p-2 text-center">
                {c.oldUperWW} → <strong>{c.newUperWW}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
