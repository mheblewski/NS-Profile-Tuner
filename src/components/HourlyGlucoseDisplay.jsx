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

// Register required Chart.js components
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
  // Generate 24-hour time labels (00:00 - 23:00)
  const hours = Array.from(
    { length: 24 },
    (_, i) => String(i).padStart(2, "0") + ":00"
  );

  // Convert hourly data to chart format, replacing null values
  const validData = hourlyAvg.map((v) => v || null);

  // Calculate dynamic Y-axis range based on actual data values
  const validValues = hourlyAvg.filter((v) => v !== null && v !== undefined);
  const maxValue = validValues.length > 0 ? Math.max(...validValues) : 200;

  // Establish Y-axis boundaries with appropriate margins
  const yMin = 40; // Fixed minimum at 40 mg/dL for hypoglycemia visibility
  const rawYMax = Math.max(200, maxValue + 40); // Minimum 200, higher if data requires
  const yMax = Math.ceil(rawYMax / 20) * 20; // Round up to nearest multiple of 20 for clean scale

  const chartData = {
    labels: hours,
    datasets: [
      {
        label: "Średnia glikemia (mg/dL)",
        data: validData,
        borderColor: "rgb(34, 197, 94)",
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: "rgb(34, 197, 94)",
        pointBorderColor: "rgb(34, 197, 94)",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true, // Connect line through missing data points
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
            return value ? `${value.toFixed(0)} mg/dL` : "No data";
          },
        },
      },
      annotation: {
        annotations: {
          // Lower glucose threshold reference line (70 mg/dL)
          line1: {
            type: "line",
            yMin: 70,
            yMax: 70,
            borderColor: "rgba(34, 197, 94, 0.5)",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: "Lower limit (70 mg/dL)",
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
          // Upper glucose threshold reference line (180 mg/dL)
          line2: {
            type: "line",
            yMin: 180,
            yMax: 180,
            borderColor: "rgba(34, 197, 94, 0.5)",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: "Upper limit (180 mg/dL)",
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
          // Target glucose range background highlight (70-180 mg/dL)
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
          display: false,
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      y: {
        display: true,
        title: {
          display: false,
        },
        min: yMin,
        max: yMax,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        // Format Y-axis tick labels with units
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
    <section className="p-4 border bg-white rounded-xl shadow-lg">
      <h3 className="font-semibold mb-4">Godzinowe średnie glikemie</h3>
      <div style={{ height: "300px", width: "100%" }}>
        <Line data={chartData} options={options} />
      </div>

      {/* Chart description and legend */}
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
