import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div
      className="min-h-screen py-6 px-1"
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
