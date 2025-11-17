import React from "react";

/**
 * Component for displaying ICR comparison table
 */
export default function ICRComparisonTable({ icrData }) {
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">ICR — porównanie</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Old (g/U)</th>
            <th className="p-2">New (g/U)</th>
            <th className="p-2">Δ%</th>
            <th className="p-2">U/WW</th>
          </tr>
        </thead>
        <tbody>
          {icrData.map((c, i) => (
            <tr key={i} className={c.pct ? "bg-yellow-50" : ""}>
              <td className="p-2">{c.time}</td>
              <td className="p-2">{c.old}</td>
              <td className="p-2 font-medium">{c.new}</td>
              <td className="p-2">{c.pct}%</td>
              <td className="p-2">
                {c.oldUperWW} → <strong>{c.newUperWW}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
