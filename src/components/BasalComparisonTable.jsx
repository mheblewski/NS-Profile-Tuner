import React from "react";

/**
 * Component for displaying basal rate comparison table
 */
export default function BasalComparisonTable({ basalData }) {
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Baza — porównanie (hourly)</h3>
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Hour</th>
            <th className="p-2">Old (U/h)</th>
            <th className="p-2">New (U/h)</th>
            <th className="p-2">Δ</th>
          </tr>
        </thead>
        <tbody>
          {basalData.map((b, idx) => {
            const changed = Math.abs(b.new - b.old) > 0.001;
            return (
              <tr key={idx} className={changed ? "bg-yellow-50" : ""}>
                <td className="p-2">{b.time}</td>
                <td className="p-2">{b.old.toFixed(2)}</td>
                <td className="p-2 font-medium">{b.new.toFixed(2)}</td>
                <td className="p-2">{b.pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
