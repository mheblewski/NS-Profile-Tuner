import React from "react";

/**
 * Component for result action buttons (copy, hide)
 */
export default function ResultActions({ result, onHideResult }) {
  const handleCopyResult = () => {
    navigator.clipboard.writeText(JSON.stringify(result.adjustments));
    alert("Skopiowano profil (JSON) do schowka");
  };

  return (
    <div className="flex gap-2">
      <button
        className="px-4 py-2 bg-indigo-600 text-white rounded"
        onClick={handleCopyResult}
      >
        Kopiuj wynik (JSON)
      </button>
      <button className="px-4 py-2 bg-gray-200 rounded" onClick={onHideResult}>
        Ukryj wynik
      </button>
    </div>
  );
}
