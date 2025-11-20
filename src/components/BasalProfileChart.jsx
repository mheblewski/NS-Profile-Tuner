import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

// Helper: how many decimal places the step has
function getStepDecimals(step) {
  if (!step || isNaN(step)) return 2;
  let s = typeof step === "string" ? step : Number(step).toFixed(20);
  if (s.indexOf(".") === -1) return 0;
  return s.split(".")[1].replace(/0+$/, "").length;
}

// Helper: round to the nearest multiple of step and format with the given number of decimals, trim trailing zeros
function formatWithStep(val, step) {
  if (val == null || isNaN(val) || !step || isNaN(step)) return "";
  const decimals = getStepDecimals(step);
  try {
    // Use Big.js if available, else fallback to native
    if (typeof Big !== "undefined") {
      const bigVal = Big(val);
      const bigStep = Big(step);
      const rounded = bigStep.times(bigVal.div(bigStep).round(0, 3));
      let str = rounded.toFixed(decimals);
      str = str.replace(".", ",");
      str = str.replace(/(,\d*?[1-9])0+$/g, "$1");
      str = str.replace(/,0*$/, "");
      return str;
    } else {
      // Fallback: native rounding
      const rounded = Math.round(val / step) * step;
      let str = rounded.toFixed(decimals);
      str = str.replace(".", ",");
      str = str.replace(/(,\d*?[1-9])0+$/g, "$1");
      str = str.replace(/,0*$/, "");
      return str;
    }
  } catch (e) {
    return "";
  }
}

export default function BasalProfileChart({ basalData, basalStep = 0.05 }) {
  console.log(basalData);
  if (!basalData || basalData.length === 0) return null;

  const labels = basalData.map((b) => b.time);
  const actual = basalData.map((b) =>
    Number(formatWithStep(b.old, basalStep).replace(",", "."))
  );
  const suggested = basalData.map((b) =>
    Number(formatWithStep(b.new, basalStep).replace(",", "."))
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Aktualna baza",
        data: actual,
        borderColor: "#2563eb",
        backgroundColor: "#2563eb22",
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: "Sugerowana baza",
        data: suggested,
        borderColor: "#f59e42",
        backgroundColor: "#f59e4222",
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return (
              context.dataset.label +
              ": " +
              context.parsed.y.toFixed(2) +
              " U/h"
            );
          },
        },
      },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "U/h",
        },
        min: 0,
      },
    },
  };

  return (
    <div
      className="mt-6 w-full"
      style={{ width: "100%", height: 300, minHeight: 300, maxHeight: 300 }}
    >
      <Line data={data} options={options} style={{ height: 300 }} />
    </div>
  );
}
