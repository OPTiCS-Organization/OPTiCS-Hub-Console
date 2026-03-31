export interface ServiceItem {
  serviceIndex: number;
  serviceName: string;
  servicePort: number;
  serviceSourceUrl: string;
  serviceStatus: 'waiting' | 'building' | 'running' | 'stopped' | 'failed' | 'removed';
  serviceVersion: string;
  serviceDeployPreset: 'dockerfile' | 'compose' | 'preset_nestjs';
  serviceCreatedAt: string;
  agentIndex: number;
  agentCode: string | null;
}
