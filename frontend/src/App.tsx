import { Routes, Route, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import ConfigPage from "./pages/ConfigPage";
import HistoryPage from "./pages/HistoryPage";
import PracticePage from "./pages/PracticePage";
import { initDatabase } from "./api/client";
import "./App.css";

function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setInitialized(true))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>Connection Error</h2>
          <p>Could not connect to the backend server.</p>
          <p>Make sure the backend is running on port 8000.</p>
          <code>{error}</code>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="app">
        <div className="loading">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Cello Scales Practice</h1>
        <nav className="nav">
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Practice
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            History
          </NavLink>
          <NavLink
            to="/config"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Config
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<PracticePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
