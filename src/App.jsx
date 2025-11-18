import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div
      className="min-h-screen p-6"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "100vw",
      }}
    >
      <NSProfileTuner defaultDays={7} />
    </div>
  );
}
