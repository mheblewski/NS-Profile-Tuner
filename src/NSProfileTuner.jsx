import React from "react";
import { useNightscoutAnalyzer } from "./logic/useNightscoutAnalyzer";
import ConfigurationForm from "./components/ConfigurationForm";
import ActionButtons from "./components/ActionButtons";
import ErrorDisplay from "./components/ErrorDisplay";
import ResultsDisplay from "./components/ResultsDisplay";

export default function NSProfileTuner({ defaultDays = 3 }) {
  const {
    // Configuration
    apiUrl,
    setApiUrl,
    token,
    setToken,
    days,
    setDays,
    basalStep,
    setBasalStep,
    canSubmit,

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
        background: "#FAFAFA",
        color: "#000000",
        border: "1px solid #ccc",
        ...(result
          ? {
              maxWidth: "95vw",
            }
          : {
              maxWidth: "700px",
              width: "90vw",
            }),
      }}
      className="mx-auto p-4"
    >
      <h1 className="text-xl font-bold mb-4">NS Profile Tuner</h1>

      <ConfigurationForm
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
        token={token}
        setToken={setToken}
        days={days}
        setDays={setDays}
        basalStep={basalStep}
        setBasalStep={setBasalStep}
      />

      <ActionButtons
        onAnalyze={analyzeAndBuild}
        onClear={clearAll}
        isLoading={isLoading}
        canSubmit={canSubmit()}
        hasResult={!!result}
      />

      <ErrorDisplay error={error} />

      <ResultsDisplay result={result} />
    </div>
  );
}
