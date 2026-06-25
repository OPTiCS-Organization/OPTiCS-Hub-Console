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

export interface ServicePortMapping {
  hostPort: number;
  containerPort: number;
}

export interface SourceRepository {
  url: string;
  rootDirectory?: string | null;
}

export interface ServiceItem {
  serviceIndex: number;
  serviceName: string;
  servicePort: number;
  serviceHostPort?: number;
  serviceContainerPort?: number;
  servicePortMappings?: ServicePortMapping[];
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
