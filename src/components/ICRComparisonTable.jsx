import React from "react";

/**
 * Component for displaying ICR comparison table
 */
export default function ICRComparisonTable({ icrData }) {
  if (!icrData || icrData.length === 0) {
    return (
      <section className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-2">Profil ICR</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Profil ICR</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-center">Godzina</th>
            <th className="p-2 text-center">Stare (g/U)</th>
            <th className="p-2 text-center">Nowe (g/U)</th>
            <th className="p-2 text-center">Δ%</th>
            <th className="p-2 text-center">U/WW</th>
            <th className="p-2 text-center hidden">Pewność</th>
            <th className="p-2 text-center hidden">Posiłki</th>
            <th className="p-2 text-center hidden">Sukces</th>
          </tr>
        </thead>
        <tbody>
          {icrData.map((c, i) => (
            <tr
              key={i}
              className={`hover:bg-gray-100 transition-colors duration-150 ${
                c.pct ? "bg-yellow-50 hover:bg-yellow-100" : ""
              }`}
            >
              <td className="p-2 text-center">{c.time}</td>
              <td className="p-2 text-center">{c.old}</td>
              <td className="p-2 text-center font-medium">{c.new}</td>
              <td className="p-2 text-center">{c.pct}%</td>
              <td className="p-2 text-center">
                {c.oldUperWW} → <strong>{c.newUperWW}</strong>
              </td>
              <td className="p-2 text-center hidden">
                {c.confidence ? (
                  <span
                    className={`px-1 py-0.5 rounded text-xs ${
                      c.confidence > 0.7
                        ? "bg-green-100 text-green-800"
                        : c.confidence > 0.4
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Math.round(c.confidence * 100)}%
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="p-2 text-center hidden">{c.mealCount || 0}</td>
              <td className="p-2 text-center hidden">
                {c.successRate !== undefined
                  ? `${Math.round(c.successRate * 100)}%`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
