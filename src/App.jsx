import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div className="flex justify-center p-4">
      <NSProfileTuner defaultDays={7} />
    </div>
  );
}
