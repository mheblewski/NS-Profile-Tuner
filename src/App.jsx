import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div
      className="min-h-screen p-2"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <NSProfileTuner defaultDays={7} />
    </div>
  );
}
