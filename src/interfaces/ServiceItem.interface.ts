export interface ContainerState {
  name: string;
  status: 'building' | 'starting' | 'running' | 'stopped' | 'failed' | 'removed';
  service?: string;
  exitCode?: number | null;
  health?: string | null;
}

export interface ContainerCounts {
  running: number;
  total: number;
}

export interface ServiceItem {
  serviceIndex: number;
  serviceName: string;
  servicePort: number;
  serviceHostPort?: number;
  serviceContainerPort?: number;
  serviceSourceUrl: string;
  serviceRootDirectory?: string | null;
  serviceEnv?: Record<string, string>;
  serviceStatus: 'waiting' | 'building' | 'starting' | 'running' | 'stopped' | 'failed' | 'removed';
  serviceSubdomain?: string | null;
  serviceVersion: string;
  serviceDeployPreset: 'dockerfile' | 'compose' | 'preset_nestjs';
  serviceCreatedAt: string;
  agentIndex: number;
  agentCode: string | null;
  agentName: string | null;
  agentUuid: string | null;
  containers?: ContainerState[];
}
