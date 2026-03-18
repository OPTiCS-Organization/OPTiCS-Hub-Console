import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Navigation from "./components/Navigation"
import { ModalProvider } from "./context/Modal.context"
import Overview from "./pages/Overview"
import Agents from "./pages/Agents"
import Users from "./pages/Users"
import Activity from "./pages/Activity"
import Settings from "./pages/Settings"

function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
        <div className="min-h-screen bg-background-color flex">
          <Navigation />
          <main className="ml-56 flex-1 p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/users" element={<Users />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </ModalProvider>
    </BrowserRouter>
  )
}

export default App
