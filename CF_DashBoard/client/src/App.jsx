import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar/TopBar";
import Dashboard from "./pages/Dashboard/Dashboard";
import Profile from "./pages/Profile/Profile";
import Contests from "./pages/Contests/Contests";
import Compare from "./pages/Compare/Compare";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <div className="app-main">
          <TopBar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/contests" element={<Contests />} />
              <Route path="/compare" element={<Compare />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
