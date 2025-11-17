import NightscoutProfileAdjuster from "./NightscoutProfileAdjuster";

export default function App() {
  return (
    <div className="flex justify-center p-4">
      <NightscoutProfileAdjuster defaultDays={3} />
    </div>
  );
}
