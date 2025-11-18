import React from "react";

/**
 * Component for action buttons (analyze, clear)
 */
export default function ActionButtons({
  onAnalyze,
  onClear,
  isLoading,
  canSubmit,
  hasResult,
}) {
  const isDisabled = isLoading || !canSubmit;

  return (
    <div className="flex gap-2 mb-4">
      <button
        className={`px-4 py-2 rounded transition-colors duration-200 ${
          isDisabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
        onClick={onAnalyze}
        disabled={isDisabled}
      >
        {isLoading ? "Analiza..." : "Analizuj i zbuduj profil"}
      </button>

      {hasResult && (
        <button
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors duration-200"
          onClick={onClear}
        >
          Wyczyść
        </button>
      )}
    </div>
  );
}
