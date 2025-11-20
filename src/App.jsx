import NSProfileTuner from "./NSProfileTuner";
import MedicalDisclaimer from "./components/MedicalDisclaimer";

export default function App() {
  return (
    <div
      className="min-h-screen py-6 px-1 flex flex-col"
      style={{
        minHeight: "100vh",
        width: "100vw",
        maxWidth: "1000px",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <NSProfileTuner defaultDays={7} />
        <MedicalDisclaimer />
      </div>
    </div>
  );
}
