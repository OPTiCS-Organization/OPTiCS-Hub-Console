import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Navigation from "./components/Navigation"
import { ModalProvider } from "./context/Modal.context"
import { AuthProvider, useAuth } from "./context/Auth.context"
import Overview from "./pages/Overview"
import Agents from "./pages/Agents"
import Users from "./pages/Users"
import Activity from "./pages/Activity"
import Settings from "./pages/Settings"
import Auth from "./pages/Auth"

function AppLayout() {
  return (
    <div className="min-h-screen bg-background-color flex">
      <Navigation />
      <main className="ml-56 flex-1 p-8">
        <Routes>
          <Route path="/overview" element={<Overview />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/users" element={<Users />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function AuthGate() {
  const { isAuthenticated } = useAuth();

  // 초기 확인 중 (쿠키 검증 대기)
  if (isAuthenticated === null) return null;

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="*" element={isAuthenticated ? <AppLayout /> : <Navigate to="/auth" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <AuthGate />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
