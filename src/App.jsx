import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div className="flex justify-center p-10">
      <NSProfileTuner defaultDays={7} />
    </div>
  );
}
