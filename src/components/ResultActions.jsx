import React from "react";

/**
 * Component for result action buttons (copy)
 */
export default function ResultActions({ result }) {
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
    </div>
  );
}
