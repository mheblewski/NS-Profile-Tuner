import React from "react";
import { useNightscoutAnalyzer } from "./logic/useNightscoutAnalyzer";
import ConfigurationForm from "./components/ConfigurationForm";
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
        color: "#000000",
        width: "100%",
        ...(result
          ? {}
          : {
              maxWidth: "700px",
              width: "90vw",
            }),
      }}
      className="mx-auto p-4"
    >
      <ConfigurationForm
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
        token={token}
        setToken={setToken}
        days={days}
        setDays={setDays}
        basalStep={basalStep}
        setBasalStep={setBasalStep}
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
