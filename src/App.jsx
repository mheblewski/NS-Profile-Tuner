import NSProfileTuner from "./NSProfileTuner";

export default function App() {
  return (
    <div
      className="min-h-screen py-6 px-1 flex flex-col justify-between"
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
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <NSProfileTuner defaultDays={7} />
      </div>
      <footer className="w-full text-center text-xs text-gray-500 py-4 px-2 mt-4">
        Ta aplikacja ma charakter informacyjny i nie powinna być używana jako
        jedyne źródło decyzji terapeutycznych. Wszelkie zmiany zawsze konsultuj
        ze swoim diabetologiem. Twórca nie ponosi odpowiedzialności za skutki
        błędnego działania algorytmu ani za decyzje podjęte na podstawie wyników
        aplikacji.
      </footer>
    </div>
  );
}
