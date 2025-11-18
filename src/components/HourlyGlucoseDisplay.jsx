import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

// Rejestrujemy potrzebne komponenty Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

/**
 * Component for displaying hourly glucose averages as a chart
 */
export default function HourlyGlucoseDisplay({ hourlyAvg }) {
  // Przygotowanie danych do wykresu
  const hours = Array.from(
    { length: 24 },
    (_, i) => String(i).padStart(2, "0") + ":00"
  );

  const validData = hourlyAvg.map((v) => v || null);

  const chartData = {
    labels: hours,
    datasets: [
      {
        label: "Średnia glikemia (mg/dL)",
        data: validData,
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "rgb(34, 197, 94)",
        pointBorderColor: "rgb(34, 197, 94)",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true, // Łączy linie przez brakujące punkty
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            return value ? `${value.toFixed(0)} mg/dL` : "Brak danych";
          },
        },
      },
      annotation: {
        annotations: {
          // Linia dolna - 70 mg/dL
          line1: {
            type: "line",
            yMin: 70,
            yMax: 70,
            borderColor: "rgba(34, 197, 94, 0.5)",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: "Dolna granica (70 mg/dL)",
              enabled: true,
              position: "end",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              color: "rgba(34, 197, 94, 0.8)",
              padding: 4,
              font: {
                size: 10,
              },
            },
          },
          // Linia górna - 180 mg/dL
          line2: {
            type: "line",
            yMin: 180,
            yMax: 180,
            borderColor: "rgba(34, 197, 94, 0.5)",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: "Górna granica (180 mg/dL)",
              enabled: true,
              position: "end",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              color: "rgba(34, 197, 94, 0.8)",
              padding: 4,
              font: {
                size: 10,
              },
            },
          },
          // Obszar prawidłowego zakresu
          box1: {
            type: "box",
            yMin: 70,
            yMax: 180,
            backgroundColor: "rgba(34, 197, 94, 0.05)",
            borderColor: "transparent",
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: "Godzina",
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: "Glikemia (mg/dL)",
        },
        min: 50,
        max: 300,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        // Dodajemy linie referencyjne dla zakresów
        ticks: {
          callback: function (value) {
            return value + " mg/dL";
          },
        },
      },
    },
    elements: {
      point: {
        hoverBorderWidth: 3,
      },
    },
  };

  return (
    <section className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-4">Godzinowe średnie glikemie</h3>
      <div style={{ height: "300px", width: "100%" }}>
        <Line data={chartData} options={options} />
      </div>

      {/* Dodatkowe informacje */}
      <div className="mt-4 text-xs text-gray-600">
        <p>
          Wykres pokazuje średnie wartości glikemii dla każdej godziny dnia.
          <span className="text-green-600 font-medium">
            {" "}
            Zielony obszar (70-180 mg/dL)
          </span>{" "}
          oznacza prawidłowy zakres glikemii.
        </p>
      </div>
    </section>
  );
}
