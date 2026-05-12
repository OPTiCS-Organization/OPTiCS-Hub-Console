import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Navigation from "./components/Navigation"
import { ModalProvider } from "./context/Modal.context"
import { AuthProvider, useAuth } from "./context/Auth.context"
import { WorkspaceProvider } from "./context/Workspace.context"
import Dashboard from "./pages/Dashboard"
import Overview from "./pages/Overview"
import Agents from "./pages/Agents"
import Users from "./pages/Users"
import Activity from "./pages/Activity"
import Settings from "./pages/Settings"
import WorkspaceSettings from "./pages/WorkspaceSettings"
import Auth from "./pages/Auth"
import Services from "./pages/Services"
import ServiceDetail from "./pages/ServiceDetail"

function AppLayout() {
  return (
    <div className="min-h-screen bg-background-color flex">
      <Navigation />
      <main className="ml-56 mr-70 flex h-screen min-h-0 flex-1 flex-col overflow-y-auto p-8">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/users" element={<Users />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/workspace-settings" element={<WorkspaceSettings />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:serviceIndex" element={<ServiceDetail />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="*" element={isAuthenticated ? <AppLayout /> : <Navigate to="/auth" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <ModalProvider>
            <AuthGate />
          </ModalProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
