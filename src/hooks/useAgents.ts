import { useState, useEffect } from "react";
import { apiFetch } from "../lib/apiFetch";
import type { AgentOption } from "../interfaces/AgentOption.interface";

export function useAgents(workspaceIndex: number | undefined, logout: () => void) {
  const [agents, setAgents] = useState<AgentOption[]>([]);

  useEffect(() => {
    if (!workspaceIndex) return;
    apiFetch(`/v1/agent/workspace/${workspaceIndex}`, {}, logout)
      .then(r => r.json())
      .then((body: { data: { agents: { agentIndex: number; agentCode: string; agentName: string; agentUuid: string; agentConnection: string }[] } }) => {
        const linked = body.data.agents.filter(a => a.agentConnection === 'linked');
        setAgents(linked);
      })
      .catch(() => { });
  }, [workspaceIndex, logout]);

  return agents;
}
