import type { ServiceItem } from "../interfaces/ServiceItem.interface";

export const statusDot: Record<ServiceItem['serviceStatus'], string> = {
  running: 'bg-green-400',
  building: 'bg-yellow-400 animate-pulse',
  starting: 'bg-yellow-400 animate-pulse',
  waiting: 'bg-secondary-text-color/40',
  stopped: 'bg-secondary-text-color/40',
  failed: 'bg-red-400',
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
