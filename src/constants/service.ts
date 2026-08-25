import type { ServiceItem } from "../interfaces/ServiceItem.interface";

export const statusDot: Record<ServiceItem['serviceStatus'], string> = {
  running: 'bg-success-color',
  building: 'bg-warning-color animate-pulse',
  starting: 'bg-warning-color animate-pulse',
  waiting: 'bg-secondary-text-color/40',
  stopped: 'bg-secondary-text-color/40',
  failed: 'bg-danger-color',
  removed: 'bg-secondary-text-color/20',
};

export const statusLabel: Record<ServiceItem['serviceStatus'], string> = {
  running: 'Running',
  building: 'Building',
  starting: 'Starting',
  waiting: 'Waiting',
  stopped: 'Stopped',
  failed: 'Failed',
  removed: 'Removed',
};

export const presetLabel: Record<ServiceItem['serviceDeployPreset'], string> = {
  dockerfile: 'Dockerfile',
  compose: 'Compose',
  preset_nestjs: 'NestJS',
};
