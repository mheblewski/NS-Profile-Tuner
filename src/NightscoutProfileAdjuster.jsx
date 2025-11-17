import React from "react";
import { useNightscoutAnalyzer } from "./logic/useNightscoutAnalyzer";
import ConfigurationForm from "./components/ConfigurationForm";
import ActionButtons from "./components/ActionButtons";
import ErrorDisplay from "./components/ErrorDisplay";
import ResultsDisplay from "./components/ResultsDisplay";

export default function NightscoutProfileAdjuster({ defaultDays = 3 }) {
  const {
    // Configuration
    apiUrl,
    setApiUrl,
    token,
    setToken,
    days,
    setDays,

    // State
    result,
    isLoading,
    error,

    // Actions
    analyzeAndBuild,
    clearAll,
  } = useNightscoutAnalyzer(defaultDays);

  return (
    <div
      style={{
        background: "#FFFFFA",
        color: "#000000",
        height: "100%",
        padding: "24px",
        border: "1px solid #ccc",
      }}
      className="max-w-4xl mx-auto"
    >
      <h1 className="text-2xl font-bold mb-4">NS Profile Tuner</h1>

      <ConfigurationForm
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
        token={token}
        setToken={setToken}
        days={days}
        setDays={setDays}
      />

      <ActionButtons
        onAnalyze={analyzeAndBuild}
        onClear={clearAll}
        isLoading={isLoading}
        apiUrl={apiUrl}
      />

      <ErrorDisplay error={error} />

      <ResultsDisplay result={result} onHideResult={clearAll} />
    </div>
  );
}
