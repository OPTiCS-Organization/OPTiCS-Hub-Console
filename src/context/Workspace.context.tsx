import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "./Auth.context";

export interface Workspace {
  workspaceIndex: number;
  workspaceName: string;
  status: string;
  lastOnline: string | null;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  selectWorkspace: (index: number) => void;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (index: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceIndex, setCurrentWorkspaceIndex] = useState<number | null>(
    () => {
      const v = localStorage.getItem("currentWorkspaceIndex");
      return v !== null ? parseInt(v) : null;
    }
  );
  const [isLoading, setIsLoading] = useState(false);

  const forceLogout = useCallback(() => logout(), [logout]);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/v1/workspace", {}, forceLogout);
      if (!res.ok) return;

      const json = await res.json() as { data: { workspaces: Workspace[] } };
      const list: Workspace[] = json.data?.workspaces ?? [];
      setWorkspaces(list);

      setCurrentWorkspaceIndex(prev => {
        const exists = list.some(w => w.workspaceIndex === prev);
        if (!exists && list.length > 0) {
          localStorage.setItem("currentWorkspaceIndex", String(list[0].workspaceIndex));
          return list[0].workspaceIndex;
        }
        if (!exists) {
          localStorage.removeItem("currentWorkspaceIndex");
          return null;
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [forceLogout]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspaceIndex(null);
    }
  }, [isAuthenticated, fetchWorkspaces]);

  function selectWorkspace(index: number) {
    setCurrentWorkspaceIndex(index);
    localStorage.setItem("currentWorkspaceIndex", String(index));
  }

  async function createWorkspace(name: string) {
    const res = await apiFetch("/v1/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceName: name }),
    }, forceLogout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? "Failed to create workspace.");
    }

    // 생성 응답에 workspace 정보가 없으므로 재조회
    await fetchWorkspaces();
  }

  async function deleteWorkspace(index: number) {
    const res = await apiFetch(`/v1/workspace/${index}`, {
      method: "DELETE",
    }, forceLogout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? "Failed to delete workspace.");
    }

    setWorkspaces(prev => {
      const next = prev.filter(w => w.workspaceIndex !== index);
      setCurrentWorkspaceIndex(cur => {
        if (cur === index) {
          const first = next[0]?.workspaceIndex ?? null;
          if (first !== null) localStorage.setItem("currentWorkspaceIndex", String(first));
          else localStorage.removeItem("currentWorkspaceIndex");
          return first;
        }
        return cur;
      });
      return next;
    });
  }

  const currentWorkspace = workspaces.find(w => w.workspaceIndex === currentWorkspaceIndex) ?? null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      currentWorkspace,
      isLoading,
      selectWorkspace,
      createWorkspace,
      deleteWorkspace,
      refresh: fetchWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
