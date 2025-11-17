import React from "react";

/**
 * Component for displaying ISF sensitivity comparison table
 */
export default function ISFComparisonTable({ isfData }) {
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">ISF (sensitivity) — porównanie</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Old (mg/dL/U)</th>
            <th className="p-2">New (mg/dL/U)</th>
            <th className="p-2">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {isfData.map((s, i) => (
            <tr key={i} className={s.pct ? "bg-yellow-50" : ""}>
              <td className="p-2">{s.time}</td>
              <td className="p-2">{s.old}</td>
              <td className="p-2 font-medium">{s.new}</td>
              <td className="p-2">{s.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
