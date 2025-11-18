import React from "react";

/**
 * Component for displaying basal rate comparison table
 */
export default function BasalComparisonTable({ basalData, basalStep = 0.05 }) {
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">
        Profil bazy
        <span className="ml-2 text-xs font-normal text-gray-600">
          * Wartości zaokrąglane do {basalStep}U
        </span>
      </h3>
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-center">Godzina</th>
            <th className="p-2 text-center">Stare (U/h)</th>
            <th className="p-2 text-center">Nowe (U/h)</th>
            <th className="p-2 text-center">Δ</th>
          </tr>
        </thead>
        <tbody>
          {basalData.map((b, idx) => {
            const changed = Math.abs(b.new - b.old) > 0.001;

            return (
              <tr
                key={idx}
                className={`hover:bg-gray-100 transition-colors duration-150 ${
                  changed ? "bg-yellow-50 hover:bg-yellow-100" : ""
                }`}
              >
                <td className="p-2 text-center">{b.time}</td>
                <td className="p-2 text-center">{b.old.toFixed(2)}</td>
                <td className="p-2 text-center font-medium">
                  {b.new.toFixed(2)}
                </td>
                <td className="p-2 text-center">{b.pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
