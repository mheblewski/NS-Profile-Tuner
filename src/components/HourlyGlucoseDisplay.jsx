import React from "react";

/**
 * Component for displaying hourly glucose averages
 */
export default function HourlyGlucoseDisplay({ hourlyAvg }) {
  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">
        Godzinowe średnie glikemii (ostatnie dane)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {hourlyAvg.map((v, i) => (
          <div key={i} className="p-2 border rounded text-sm bg-gray-50">
            {String(i).padStart(2, "0")}:00 —{" "}
            {v ? v.toFixed(0) + " mg/dL" : "brak danych"}
          </div>
        ))}
      </div>
    </section>
  );
}
