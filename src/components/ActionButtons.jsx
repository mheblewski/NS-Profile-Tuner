import React from "react";

/**
 * Component for action buttons (analyze, clear)
 */
export default function ActionButtons({
  onAnalyze,
  onClear,
  isLoading,
  apiUrl,
}) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        className="px-4 py-2 bg-green-600 text-white rounded"
        onClick={onAnalyze}
        disabled={isLoading || !apiUrl}
      >
        {isLoading ? "Analiza..." : "Analizuj i zbuduj profil"}
      </button>

      <button className="px-4 py-2 bg-gray-200 rounded" onClick={onClear}>
        Wyczyść
      </button>
    </div>
  );
}
