import React from "react";

/**
 * Component for configuring API connection settings
 */
export default function ConfigurationForm({
  apiUrl,
  setApiUrl,
  token,
  setToken,
  days,
  setDays,
  basalStep,
  setBasalStep,
}) {
  return (
    <div className="p-4 border rounded mb-4">
      <label className="block text-sm">Nightscout URL</label>
      <input
        style={{
          background: "#FFFFFF",
          color: "#000000",
        }}
        className="w-full p-2 border rounded mb-2"
        value={apiUrl}
        onChange={(e) => setApiUrl(e.target.value)}
      />

      <label className="block text-sm">Token (dopisywany do URL)</label>
      <input
        style={{
          background: "#FFFFFF",
          color: "#000000",
        }}
        className="w-full p-2 border rounded mb-2"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />

      <label className="block text-sm">Zakres danych (dni)</label>
      <input
        style={{
          background: "#FFFFFF",
          color: "#000000",
        }}
        type="number"
        min="1"
        max="30"
        className="w-full p-2 border rounded mb-2"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      />

      <label className="block text-sm">Skok bazy (U/h)</label>
      <input
        style={{
          background: "#FFFFFF",
          color: "#000000",
        }}
        type="number"
        min="0.001"
        max="1"
        step="0.001"
        className="w-full p-2 border rounded mb-2"
        value={basalStep}
        onChange={(e) => setBasalStep(Number(e.target.value))}
      />
    </div>
  );
}
