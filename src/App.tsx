import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom"
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
import AgentDetail from "./pages/AgentDetail"
import PatchNotes from "./pages/PatchNotes"
import UnverifiedBanner from "./components/UnverifiedBanner"

function AppLayout() {
  return (
    <div className="min-h-screen bg-background-color flex">
      <Navigation />
      <main
        className="flex h-screen min-h-0 flex-1 flex-col overflow-y-auto p-8 pr-[var(--content-gutter-right)] transition-[margin-left,padding-right] duration-200"
        style={{ marginLeft: "var(--nav-width)" }}
      >
        {/*
          오른쪽 여백(--content-gutter-right)이 사이드바 무게를 받아 준 위에서,
          남은 자리 안에 본문을 가운데 정렬한다. 최대 폭을 두는 것은 넓은 화면에서
          한 줄이 지나치게 길어지지 않게 하기 위한 것이다.
        */}
        <div className="mx-auto flex w-full max-w-[80rem] flex-1 flex-col">
          <UnverifiedBanner />
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:agentUuid" element={<AgentDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/workspace-settings" element={<WorkspaceSettings />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:serviceIndex" element={<ServiceDetail />} />
            <Route path="/patch-notes" element={<PatchNotes />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function AuthGate() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // 메일의 인증 링크는 로그인 상태여도 /auth 에서 처리해야 한다.
  // 그냥 대시보드로 튕기면 코드가 소진되지 않아 계정이 미인증으로 남는다.
  //
  // 첫 렌더 시점의 값을 고정한다. Auth 페이지가 코드를 읽은 뒤 주소창을 정리하는데,
  // 그때마다 다시 계산하면 파라미터가 사라지는 순간 이 조건이 뒤집혀
  // 인증 결과 화면을 띄우기도 전에 Auth 가 언마운트된다.
  // 훅이므로 아래 조기 리턴보다 먼저 호출해야 한다.
  const [hasVerificationCode] = useState(
    () => searchParams.has("verify") || searchParams.has("verify-existing"),
  );

  // 초기 확인 중 (쿠키 검증 대기)
  if (isAuthenticated === null) return null;

  return (
    <Routes>
      <Route
        path="/auth"
        element={isAuthenticated && !hasVerificationCode ? <Navigate to="/dashboard" replace /> : <Auth />}
      />
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
