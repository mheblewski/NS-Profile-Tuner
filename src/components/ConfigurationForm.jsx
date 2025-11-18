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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Nightscout URL</label>
            <input
              style={{
                background: "#FFFFFF",
                color: "#000000",
              }}
              className="w-full p-2 text-sm border rounded"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="Wprowadź URL"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Token</label>
            <input
              style={{
                background: "#FFFFFF",
                color: "#000000",
              }}
              className="w-full p-2 text-sm border rounded"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Wprowadź token"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <div>
            <label className="block text-sm mb-1">Zakres danych</label>
            <div className="relative">
              <input
                style={{
                  background: "#FFFFFF",
                  color: "#000000",
                }}
                type="number"
                min="1"
                max="30"
                className="w-full p-2 pr-12 text-sm border rounded"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                dni
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Skok bazy</label>
            <div className="relative">
              <input
                style={{
                  background: "#FFFFFF",
                  color: "#000000",
                }}
                type="number"
                min="0.001"
                max="1"
                step="0.001"
                className="w-full p-2 pr-8 text-sm border rounded"
                value={basalStep}
                onChange={(e) => setBasalStep(Number(e.target.value))}
                placeholder="0.05"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                U
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
