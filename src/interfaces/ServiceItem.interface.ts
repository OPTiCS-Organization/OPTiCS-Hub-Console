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

export interface ServiceComponent {
  componentIndex: number;
  componentName: string;
  containerName?: string | null;
  status: 'waiting' | 'building' | 'starting' | 'running' | 'stopped' | 'failed' | 'removed' | 'restarting';
  health?: string | null;
  exitCode?: number | null;
  updatedAt: string;
}

export interface ServiceEndpoint {
  endpointIndex: number;
  componentName?: string | null;
  subdomain?: string | null;
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
  components?: ServiceComponent[];
  endpoints?: ServiceEndpoint[];
}
