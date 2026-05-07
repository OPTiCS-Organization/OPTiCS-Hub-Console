export interface ServiceFormState {
  serviceName: string;
  servicePort: string;
  serviceHostPort?: string;
  serviceContainerPort?: string;
  serviceRootDirectory?: string;
  serviceSourceUrls: string[];
  serviceVersion: string;
  serviceDeployPreset: string;
  agentIndex: string;
}
