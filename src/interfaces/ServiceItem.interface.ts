export interface ServiceItem {
  serviceIndex: number;
  serviceName: string;
  servicePort: number;
  serviceHostPort?: number;
  serviceContainerPort?: number;
  serviceSourceUrl: string;
  serviceRootDirectory?: string | null;
  serviceEnv?: Record<string, string>;
  serviceStatus: 'waiting' | 'building' | 'running' | 'stopped' | 'failed' | 'removed';
  serviceVersion: string;
  serviceDeployPreset: 'dockerfile' | 'compose' | 'preset_nestjs';
  serviceCreatedAt: string;
  agentIndex: number;
  agentCode: string | null;
  agentName: string | null;
  agentUuid: string | null;
}
