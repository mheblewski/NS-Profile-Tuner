import React from "react";

/**
 * Component for displaying ISF sensitivity comparison table
 */
export default function ISFComparisonTable({ isfData }) {
  if (!isfData || isfData.length === 0) {
    return (
      <section className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-2">Profil ISF</h3>
        <div className="text-center text-gray-500 py-8">Brak danych</div>
      </section>
    );
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Profil ISF</h3>
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-center">Godzina</th>
            <th className="p-2 text-center">Stare (mg/dL/U)</th>
            <th className="p-2 text-center">Nowe (mg/dL/U)</th>
            <th className="p-2 text-center">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {isfData.map((s, i) => (
            <tr
              key={i}
              className={`hover:bg-gray-100 transition-colors duration-150 ${
                s.pct ? "bg-yellow-50 hover:bg-yellow-100" : ""
              }`}
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
